// Jenkinsfile → .pushci.yml translator (Stream B, Norlys pilot).
//
// This is a pragmatic regex-based parser, NOT a full Groovy CST. It handles
// the declarative pipeline subset we see in the Norlys Jenkins estate:
//
//   pipeline {
//     agent { ... }
//     environment { KEY = 'value' }
//     stages {
//       stage('Build') { steps { sh 'mvn clean package' } }
//     }
//     post {
//       failure { sh './scripts/notify-failure.sh' }
//       success { echo 'built' }
//     }
//   }
//
// Anything non-declarative, scripted pipelines, and complex Groovy constructs
// are ignored gracefully — we emit what we can and leave the rest as
// TODO comments for a human migrator. No Groovy parser library is used.
//
// License: Apache-2.0

export interface ImportedStage {
  name: string;
  steps: string[];
}

export interface ImportedHooks {
  on_failure?: string[];
  on_success?: string[];
  always?: string[];
}

export type ImportedStack = "java-maven" | "java-gradle" | "node" | "python" | "unknown";

export interface ImportedPipeline {
  name: string;
  stack: ImportedStack;
  env: Record<string, string>;
  stages: ImportedStage[];
  hooks: ImportedHooks;
  warnings: string[];
}

// --- Block extraction helpers -------------------------------------------

/**
 * Find a brace-delimited block by its label, returning the contents between
 * the matching braces. Supports nesting so `stages { stage { steps { ... } } }`
 * returns everything inside the outer `stages`. Returns empty string if no
 * such block exists.
 */
export function extractBlock(source: string, label: string): string {
  const re = new RegExp(`\\b${escapeRegex(label)}\\b\\s*\\{`, "g");
  const match = re.exec(source);
  if (!match) return "";
  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return "";
}

/** Find ALL top-level occurrences of `label { ... }` in `source`. */
export function extractAllBlocks(source: string, label: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${escapeRegex(label)}\\b\\s*\\(?[^{]*\\{`, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push(source.slice(start, i));
    re.lastIndex = i + 1;
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Field parsers -------------------------------------------------------

/**
 * Extract `KEY = 'value'` pairs from an environment block body. Accepts
 * single-quoted, double-quoted, and bareword right-hand sides.
 */
export function parseEnvBlock(body: string): Record<string, string> {
  const env: Record<string, string> = {};
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s\n]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    env[m[1]] = value;
  }
  return env;
}

/**
 * Extract every `sh '...'` / `sh "..."` / `sh """..."""` invocation from a
 * body. Returns the command strings in document order.
 */
export function parseShSteps(body: string): string[] {
  const steps: string[] = [];
  // Triple-quoted first so the simple matcher doesn't chop them apart.
  const tripleRe = /\bsh\s*\(?\s*"""([\s\S]*?)"""\s*\)?/g;
  const masked = body.replace(tripleRe, (_full, script: string) => {
    steps.push(String(script).trim());
    return "\n";
  });
  const simpleRe = /\bsh\s*\(?\s*(?:'([^']*)'|"([^"]*)")\s*\)?/g;
  let m: RegExpExecArray | null;
  while ((m = simpleRe.exec(masked)) !== null) {
    const val = (m[1] ?? m[2] ?? "").trim();
    if (val) steps.push(val);
  }
  return steps;
}

/** Pull `stage('Name') { steps { ... } }` definitions out of a stages body. */
export function parseStages(stagesBody: string): ImportedStage[] {
  const out: ImportedStage[] = [];
  const re = /\bstage\s*\(\s*(?:'([^']*)'|"([^"]*)")\s*\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stagesBody)) !== null) {
    const name = m[1] ?? m[2] ?? "stage";
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    for (; i < stagesBody.length; i++) {
      const ch = stagesBody[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const inner = stagesBody.slice(start, i);
    // Prefer the `steps` sub-block when present — otherwise scan the whole
    // stage body so `stage('X') { sh 'echo' }` still produces a step.
    const stepsBody = extractBlock(inner, "steps") || inner;
    const steps = parseShSteps(stepsBody);
    out.push({ name, steps });
    re.lastIndex = i + 1;
  }
  return out;
}

/** Parse the declarative `post { failure { } success { } always { } }` block. */
export function parsePostHooks(postBody: string): ImportedHooks {
  const hooks: ImportedHooks = {};
  const failure = extractBlock(postBody, "failure");
  const success = extractBlock(postBody, "success");
  const always = extractBlock(postBody, "always");
  if (failure) hooks.on_failure = parseShSteps(failure);
  if (success) hooks.on_success = parseShSteps(success);
  if (always) hooks.always = parseShSteps(always);
  return hooks;
}

// --- Stack detection -----------------------------------------------------

export function detectStack(allSteps: string[]): ImportedStack {
  const joined = allSteps.join("\n");
  if (/\bmvn\b/.test(joined) || /mvnw/.test(joined)) return "java-maven";
  if (/\bgradle\b/.test(joined) || /gradlew/.test(joined)) return "java-gradle";
  if (/\bnpm\b|\bpnpm\b|\byarn\b/.test(joined)) return "node";
  if (/\bpytest\b|\bpython\b|\bpip\b/.test(joined)) return "python";
  return "unknown";
}

// --- Top-level entry point ----------------------------------------------

export function parseJenkinsfile(source: string): ImportedPipeline {
  const warnings: string[] = [];
  // Strip `// line` and `/* block */` comments so our block matchers
  // don't get confused by commented-out pipeline scaffolding.
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const pipelineBody = extractBlock(clean, "pipeline") || clean;

  const envBody = extractBlock(pipelineBody, "environment");
  const env = envBody ? parseEnvBlock(envBody) : {};

  const stagesBody = extractBlock(pipelineBody, "stages");
  const stages = stagesBody ? parseStages(stagesBody) : [];
  if (!stagesBody) warnings.push("no 'stages' block found — is this a scripted pipeline?");

  const postBody = extractBlock(pipelineBody, "post");
  const hooks = postBody ? parsePostHooks(postBody) : {};

  const allSteps = stages.flatMap((s) => s.steps);
  const stack = detectStack(allSteps);

  // Try to infer a pipeline name from `pipeline { name = '...' }` or fall
  // back to "jenkins-import". Declarative Jenkinsfiles don't actually have
  // a `name` field, so this is a best-effort nicety.
  const nameMatch = /\bname\s*=\s*(?:'([^']*)'|"([^"]*)")/.exec(pipelineBody);
  const name = (nameMatch?.[1] ?? nameMatch?.[2] ?? "jenkins-import").trim();

  return { name, stack, env, stages, hooks, warnings };
}

// --- YAML emission -------------------------------------------------------

function yamlQuote(value: string): string {
  if (value === "") return "''";
  if (/^[A-Za-z0-9_./:@=+\-]+$/.test(value)) return value;
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Render an ImportedPipeline as a .pushci.yml string. We emit a simple
 * stage/run shape that the PushCI engine understands. The schema shape is
 * deliberately conservative — consumers of this function can enrich it.
 */
export function toPushciYaml(pipeline: ImportedPipeline): string {
  const lines: string[] = [];
  lines.push("# Imported from Jenkinsfile by PushCI");
  if (pipeline.warnings.length > 0) {
    for (const w of pipeline.warnings) lines.push(`# WARNING: ${w}`);
  }
  lines.push(`version: '1'`);
  lines.push(`name: ${yamlQuote(pipeline.name)}`);
  lines.push(`stack: ${pipeline.stack}`);

  if (Object.keys(pipeline.env).length > 0) {
    lines.push("env:");
    for (const [k, v] of Object.entries(pipeline.env)) {
      lines.push(`  ${k}: ${yamlQuote(v)}`);
    }
  }

  lines.push("stages:");
  if (pipeline.stages.length === 0) {
    lines.push("  # no stages detected — review the source Jenkinsfile");
  }
  for (const stage of pipeline.stages) {
    lines.push(`  - name: ${yamlQuote(stage.name)}`);
    if (stage.steps.length === 0) {
      lines.push(`    run: []`);
    } else {
      lines.push(`    run:`);
      for (const step of stage.steps) lines.push(`      - ${yamlQuote(step)}`);
    }
  }

  const { on_failure, on_success, always } = pipeline.hooks;
  if (on_failure?.length || on_success?.length || always?.length) {
    lines.push("hooks:");
    if (on_failure?.length) {
      lines.push("  on_failure:");
      for (const step of on_failure) lines.push(`    - ${yamlQuote(step)}`);
    }
    if (on_success?.length) {
      lines.push("  on_success:");
      for (const step of on_success) lines.push(`    - ${yamlQuote(step)}`);
    }
    if (always?.length) {
      lines.push("  always:");
      for (const step of always) lines.push(`    - ${yamlQuote(step)}`);
    }
  }

  return lines.join("\n") + "\n";
}

/** Convenience wrapper: source string → YAML string in one call. */
export function jenkinsfileToPushciYaml(source: string): {
  pipeline: ImportedPipeline;
  yaml: string;
} {
  const pipeline = parseJenkinsfile(source);
  const yaml = toPushciYaml(pipeline);
  return { pipeline, yaml };
}
