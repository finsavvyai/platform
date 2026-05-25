// .circleci/config.yml → pushci.yml translator. Pragmatic line-oriented
// parser (NOT full YAML); handles the subset CircleCI users actually ship:
// jobs.<name>.steps entries with `- run: <cmd>` or the block form
// `- run: { name, command }`. Warns and degrades gracefully otherwise.
// License: Apache-2.0

export interface ImportedStage {
  name: string;
  steps: string[];
}

export type ImportedStack = "node" | "python" | "java-maven" | "java-gradle" | "go" | "ruby" | "unknown";

export interface ImportedPipeline {
  name: string;
  stack: ImportedStack;
  stages: ImportedStage[];
  warnings: string[];
}

function indentOf(line: string): number {
  const m = line.match(/^( *)/);
  return m ? m[1].length : 0;
}

function stripComment(line: string): string {
  const hash = line.indexOf(" #");
  return hash >= 0 ? line.slice(0, hash) : line;
}

function preprocess(src: string): string[] {
  return src
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => stripComment(l).replace(/\s+$/, ""))
    .filter((l) => l.length > 0 && !/^\s*#/.test(l));
}

/** Indented children of the line at `start-1` (whose indent is `baseIndent`). */
function sectionLines(lines: string[], start: number, baseIndent: number): string[] {
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (indentOf(lines[i]) <= baseIndent && lines[i].trim().length > 0) break;
    out.push(lines[i]);
  }
  return out;
}

/** Find the top-level `jobs:` block and return its indented children. */
export function extractJobsSection(src: string): string[] {
  const lines = preprocess(src);
  for (let i = 0; i < lines.length; i++) {
    if (/^jobs\s*:\s*$/.test(lines[i])) {
      return sectionLines(lines, i + 1, indentOf(lines[i]));
    }
  }
  return [];
}

/** Walk a `jobs:` body and return each `<jobName>:` block keyed by name. */
export function splitJobs(jobsLines: string[]): Array<{ name: string; body: string[] }> {
  const jobs: Array<{ name: string; body: string[] }> = [];
  if (jobsLines.length === 0) return jobs;
  const jobIndent = indentOf(jobsLines[0]);
  for (let i = 0; i < jobsLines.length; i++) {
    if (indentOf(jobsLines[i]) !== jobIndent) continue;
    const m = jobsLines[i].trim().match(/^([A-Za-z0-9_\-]+)\s*:\s*$/);
    if (!m) continue;
    const body = sectionLines(jobsLines, i + 1, jobIndent);
    jobs.push({ name: m[1], body });
    i += body.length;
  }
  return jobs;
}

function stripQuotes(s: string): string {
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    return s.slice(1, -1);
  }
  return s;
}

function collectBlockScalar(body: string[], idx: number, baseIndent: number): string {
  const parts: string[] = [];
  for (let j = idx + 1; j < body.length; j++) {
    if (indentOf(body[j]) <= baseIndent && body[j].trim().length > 0) break;
    parts.push(body[j].trim());
  }
  return parts.join(" && ");
}

/**
 * Extract shell commands from a job body. Supports one-liner
 * `- run: <cmd>` and the block form `- run: { name, command }`.
 */
export function extractJobCommands(body: string[]): string[] {
  const cmds: string[] = [];
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    const trimmed = line.trim();
    const oneLine = trimmed.match(/^-\s*run\s*:\s*(.+)$/);
    if (oneLine) {
      const value = oneLine[1].trim();
      if (value === "|" || value === ">" || value.endsWith(":")) continue;
      cmds.push(stripQuotes(value));
      continue;
    }
    if (/^-\s*run\s*:\s*$/.test(trimmed)) {
      const baseIndent = indentOf(line);
      for (let j = i + 1; j < body.length; j++) {
        const inner = body[j];
        if (indentOf(inner) <= baseIndent && inner.trim().length > 0) break;
        const cmdMatch = inner.trim().match(/^command\s*:\s*(.*)$/);
        if (cmdMatch) {
          const val = cmdMatch[1].trim();
          if (val && val !== "|" && val !== ">") cmds.push(stripQuotes(val));
          else cmds.push(collectBlockScalar(body, j, indentOf(inner)));
          break;
        }
      }
    }
  }
  return cmds;
}

export function detectStack(allSteps: string[]): ImportedStack {
  const joined = allSteps.join("\n");
  if (/\bmvn\b|mvnw/.test(joined)) return "java-maven";
  if (/\bgradle\b|gradlew/.test(joined)) return "java-gradle";
  if (/\bgo\s+(test|build)\b/.test(joined)) return "go";
  if (/\bnpm\b|\bpnpm\b|\byarn\b/.test(joined)) return "node";
  if (/\bpytest\b|\bpython\b|\bpip\b/.test(joined)) return "python";
  if (/\bbundle\b|\brake\b|\brspec\b/.test(joined)) return "ruby";
  return "unknown";
}

export function parseCircleCIConfig(source: string): ImportedPipeline {
  const warnings: string[] = [];
  const jobsBody = extractJobsSection(source);
  if (jobsBody.length === 0) {
    warnings.push("no 'jobs:' block found — is this a valid CircleCI config?");
    return { name: "circleci-import", stack: "unknown", stages: [], warnings };
  }
  const stages: ImportedStage[] = splitJobs(jobsBody).map((j) => ({
    name: j.name,
    steps: extractJobCommands(j.body),
  }));
  const allSteps = stages.flatMap((s) => s.steps);
  if (allSteps.length === 0) warnings.push("no shell commands found — orb-only workflow?");
  return { name: "circleci-import", stack: detectStack(allSteps), stages, warnings };
}

function yamlQuote(v: string): string {
  if (v === "") return "''";
  if (/^[A-Za-z0-9_./:@=+\-]+$/.test(v)) return v;
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function toPushciYaml(p: ImportedPipeline): string {
  const lines: string[] = [];
  lines.push("# Imported from .circleci/config.yml by PushCI");
  for (const w of p.warnings) lines.push(`# WARNING: ${w}`);
  lines.push(`version: '1'`);
  lines.push(`name: ${yamlQuote(p.name)}`);
  lines.push(`stack: ${p.stack}`);
  lines.push("stages:");
  if (p.stages.length === 0) lines.push("  # no stages detected");
  for (const s of p.stages) {
    lines.push(`  - name: ${yamlQuote(s.name)}`);
    if (s.steps.length === 0) lines.push(`    run: []`);
    else {
      lines.push(`    run:`);
      for (const step of s.steps) lines.push(`      - ${yamlQuote(step)}`);
    }
  }
  return lines.join("\n") + "\n";
}

export function circleCIConfigToPushciYaml(source: string): {
  pipeline: ImportedPipeline;
  yaml: string;
} {
  const pipeline = parseCircleCIConfig(source);
  return { pipeline, yaml: toPushciYaml(pipeline) };
}
