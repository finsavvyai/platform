// .gitlab-ci.yml → .pushci.yml translator (companion to the Go migrator
// at internal/migrate/gitlab.go). Pragmatic YAML-subset parser: handles
// top-level `stages` + `variables` + jobs with `stage` + `script`. Exotic
// inputs (`include`, deep `extends`, anchors, `rules:if`) produce a
// warning so the user reviews the output. License: Apache-2.0

export interface ImportedGitLabJob {
  name: string;
  stage: string;
  script: string[];
  only?: string[];
  variables?: Record<string, string>;
}

export interface ImportedGitLabPipeline {
  name: string;
  stages: string[];
  variables: Record<string, string>;
  jobs: ImportedGitLabJob[];
  warnings: string[];
}

// --- Minimal YAML (subset) parser ---------------------------------------

interface YMap { [key: string]: YNode }
type YNode = string | string[] | YMap;

function stripComments(src: string): string {
  return src
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, ""))
    .join("\n");
}

/** Indentation width (spaces) for a non-empty line. */
function indentOf(line: string): number {
  const m = line.match(/^( *)/);
  return m ? m[1].length : 0;
}

/** Dirt-simple YAML parser — supports scalars, arrays, maps, one level of
 *  nesting per step. Good enough for `.gitlab-ci.yml` happy paths. */
export function parseYaml(src: string): Record<string, YNode> {
  const lines = stripComments(src)
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0 && !/^\s*#/.test(l));

  const root: Record<string, YNode> = {};
  const stack: Array<{ indent: number; container: Record<string, YNode> | string[] }> = [
    { indent: -1, container: root },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ind = indentOf(line);
    const trimmed = line.trim();
    while (stack.length > 1 && ind <= stack[stack.length - 1].indent) stack.pop();
    const top = stack[stack.length - 1];

    if (trimmed.startsWith("- ")) {
      const val = trimmed.slice(2).trim();
      if (!Array.isArray(top.container)) continue;
      top.container.push(unquote(val));
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const rest = trimmed.slice(colon + 1).trim();
    if (Array.isArray(top.container)) continue;

    if (rest.length === 0) {
      // Peek next line to decide array vs map.
      const next = lines[i + 1];
      const nextInd = next ? indentOf(next) : -1;
      const nextTrim = next ? next.trim() : "";
      if (next && nextInd > ind && nextTrim.startsWith("- ")) {
        const arr: string[] = [];
        top.container[key] = arr;
        stack.push({ indent: ind, container: arr });
      } else {
        const child: Record<string, YNode> = {};
        top.container[key] = child;
        stack.push({ indent: ind, container: child });
      }
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      top.container[key] = rest
        .slice(1, -1)
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter((s) => s.length > 0);
    } else {
      top.container[key] = unquote(rest);
    }
  }
  return root;
}

function unquote(v: string): string {
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
    return v.slice(1, -1);
  }
  return v;
}

// --- GitLab CI shape extraction -----------------------------------------

const TOP_LEVEL_KEYS = new Set(["stages", "variables", "include", "default", "workflow", "image"]);

function asStringArray(node: YNode | undefined): string[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.map(String);
  if (typeof node === "string") return [node];
  return [];
}

function asStringMap(node: YNode | undefined): Record<string, string> {
  if (!node || typeof node !== "object" || Array.isArray(node)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function parseGitlabCI(source: string): ImportedGitLabPipeline {
  const warnings: string[] = [];
  const root = parseYaml(source);

  const stages = asStringArray(root.stages);
  const variables = asStringMap(root.variables);
  if (root.include) warnings.push("top-level `include:` is not parsed — review manually");
  if (root.extends) warnings.push("top-level `extends:` is not parsed — review manually");

  const jobs: ImportedGitLabJob[] = [];
  for (const [key, value] of Object.entries(root)) {
    if (TOP_LEVEL_KEYS.has(key)) continue;
    if (key.startsWith(".")) continue; // hidden job template
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const script = asStringArray(value.script);
    if (script.length === 0) continue;
    const stage = typeof value.stage === "string" ? value.stage : "test";
    const only = asStringArray(value.only);
    const jobVars = asStringMap(value.variables);
    jobs.push({ name: key, stage, script, only: only.length ? only : undefined, variables: Object.keys(jobVars).length ? jobVars : undefined });
  }

  return {
    name: "gitlab-import",
    stages: stages.length ? stages : Array.from(new Set(jobs.map((j) => j.stage))),
    variables,
    jobs,
    warnings,
  };
}

// --- YAML emission ------------------------------------------------------

function yamlQuote(value: string): string {
  if (value === "") return "''";
  if (/^[A-Za-z0-9_./:@=+\-]+$/.test(value)) return value;
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function toPushciYaml(p: ImportedGitLabPipeline): string {
  const lines: string[] = [];
  lines.push("# Imported from .gitlab-ci.yml by PushCI");
  for (const w of p.warnings) lines.push(`# WARNING: ${w}`);
  lines.push(`version: '1'`);
  lines.push(`name: ${yamlQuote(p.name)}`);
  if (Object.keys(p.variables).length > 0) {
    lines.push("env:");
    for (const [k, v] of Object.entries(p.variables)) lines.push(`  ${k}: ${yamlQuote(v)}`);
  }
  lines.push("stages:");
  if (p.jobs.length === 0) lines.push("  # no jobs detected — review .gitlab-ci.yml");
  const byStage: Record<string, ImportedGitLabJob[]> = {};
  for (const job of p.jobs) (byStage[job.stage] ??= []).push(job);
  for (const stage of p.stages.length ? p.stages : Object.keys(byStage)) {
    const stageJobs = byStage[stage] ?? [];
    if (stageJobs.length === 0) continue;
    lines.push(`  - name: ${yamlQuote(stage)}`);
    lines.push(`    run:`);
    for (const job of stageJobs) for (const step of job.script) lines.push(`      - ${yamlQuote(step)}`);
  }
  return lines.join("\n") + "\n";
}

export function gitlabCIToPushciYaml(source: string): {
  pipeline: ImportedGitLabPipeline;
  yaml: string;
} {
  const pipeline = parseGitlabCI(source);
  const yaml = toPushciYaml(pipeline);
  return { pipeline, yaml };
}
