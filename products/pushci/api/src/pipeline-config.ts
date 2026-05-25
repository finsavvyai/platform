// Pipeline config parser: .pushci.yml validation and generation.

import { Hono } from "hono";
import type { Env } from "./types";

type Bindings = Env;

export interface StepConfig {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
  if?: string;
}

export interface JobConfig {
  name?: string;
  runs_on?: string;
  needs?: string[];
  env?: Record<string, string>;
  steps: StepConfig[];
  if?: string;
  timeout_minutes?: number;
  matrix?: Record<string, string[]>;
}

export interface PipelineConfig {
  version: string;
  name?: string;
  on?: {
    push?: { branches?: string[] };
    pull_request?: { branches?: string[] };
  };
  env?: Record<string, string>;
  jobs: Record<string, JobConfig>;
}

// --- Minimal YAML subset parser ---

function parseYamlValue(raw: string): unknown {
  const v = raw.trim();
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~" || v === "") return null;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  // Strip surrounding quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    return v.slice(1, -1);
  // Inline array: [a, b, c]
  if (v.startsWith("[") && v.endsWith("]")) {
    return v.slice(1, -1).split(",").map((s) => {
      const t = s.trim();
      return (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))
        ? t.slice(1, -1) : t;
    });
  }
  return v;
}

function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function parseYaml(text: string): Record<string, unknown> {
  const lines = text.split("\n");
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [{ indent: -1, obj: root }];
  let currentArray: unknown[] | null = null;
  let currentArrayKey = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = getIndent(line);
    const trimmed = line.trim();

    // Pop stack to correct parent
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
      currentArray = null;
    }
    const parent = stack[stack.length - 1].obj;

    // Array item: "- value" or "- key: value"
    if (trimmed.startsWith("- ")) {
      const itemContent = trimmed.slice(2).trim();
      if (!currentArray) {
        currentArray = [];
        parent[currentArrayKey] = currentArray;
      }
      if (itemContent.includes(": ")) {
        const colonIdx = itemContent.indexOf(": ");
        const obj: Record<string, unknown> = {};
        obj[itemContent.slice(0, colonIdx).trim()] = parseYamlValue(itemContent.slice(colonIdx + 2));
        currentArray.push(obj);
        stack.push({ indent, obj });
      } else {
        currentArray.push(parseYamlValue(itemContent));
      }
      continue;
    }

    currentArray = null;

    // Key-value pair
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim();

    if (val === "" || val === "|" || val === ">") {
      // Nested object or block scalar
      if (val === "|" || val === ">") {
        // Collect block scalar lines
        let block = "";
        while (i + 1 < lines.length && getIndent(lines[i + 1]) > indent) {
          i++;
          block += (block ? "\n" : "") + lines[i].trim();
        }
        parent[key] = block;
      } else {
        const child: Record<string, unknown> = {};
        parent[key] = child;
        stack.push({ indent, obj: child });
        currentArrayKey = key;
      }
    } else {
      parent[key] = parseYamlValue(val);
      currentArrayKey = key;
    }
  }

  return root;
}

// --- Config parser ---

export function parsePipelineConfig(yaml: string): PipelineConfig {
  const raw = parseYaml(yaml) as Record<string, unknown>;
  const config: PipelineConfig = {
    version: String(raw.version ?? "1"),
    name: raw.name as string | undefined,
    env: raw.env as Record<string, string> | undefined,
    jobs: {},
  };

  if (raw.on && typeof raw.on === "object") {
    const on = raw.on as Record<string, unknown>;
    config.on = {};
    if (on.push && typeof on.push === "object") {
      config.on.push = { branches: (on.push as Record<string, unknown>).branches as string[] };
    }
    if (on.pull_request && typeof on.pull_request === "object") {
      config.on.pull_request = {
        branches: (on.pull_request as Record<string, unknown>).branches as string[],
      };
    }
  }

  const jobs = (raw.jobs ?? {}) as Record<string, Record<string, unknown>>;
  for (const [id, job] of Object.entries(jobs)) {
    const steps = ((job.steps ?? []) as Record<string, unknown>[]).map((s) => ({
      name: s.name as string | undefined,
      run: s.run as string | undefined,
      uses: s.uses as string | undefined,
      with: s.with as Record<string, string> | undefined,
      env: s.env as Record<string, string> | undefined,
      if: s.if as string | undefined,
    }));
    config.jobs[id] = {
      name: job.name as string | undefined,
      runs_on: (job.runs_on ?? job["runs-on"]) as string | undefined,
      needs: job.needs as string[] | undefined,
      env: job.env as Record<string, string> | undefined,
      steps,
      if: job.if as string | undefined,
      timeout_minutes: job.timeout_minutes as number | undefined,
      matrix: job.matrix as Record<string, string[]> | undefined,
    };
  }

  return config;
}

// --- Validator ---

export function validatePipelineConfig(config: PipelineConfig): string[] {
  const errors: string[] = [];

  if (!config.version) errors.push("version is required");

  if (!config.jobs || Object.keys(config.jobs).length === 0) {
    errors.push("at least one job is required");
    return errors;
  }

  const jobIds = new Set(Object.keys(config.jobs));

  for (const [id, job] of Object.entries(config.jobs)) {
    if (!job.steps || job.steps.length === 0) {
      errors.push(`job "${id}" must have at least one step`);
    }

    for (let i = 0; i < (job.steps ?? []).length; i++) {
      const step = job.steps[i];
      if (!step.run && !step.uses) {
        errors.push(`job "${id}" step ${i + 1} must have "run" or "uses"`);
      }
    }

    if (job.needs) {
      for (const dep of job.needs) {
        if (!jobIds.has(dep)) errors.push(`job "${id}" depends on unknown job "${dep}"`);
      }
    }

    if (job.timeout_minutes != null && (job.timeout_minutes < 1 || job.timeout_minutes > 360)) {
      errors.push(`job "${id}" timeout_minutes must be between 1 and 360`);
    }
  }

  // Detect circular dependencies
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function hasCycle(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dep of config.jobs[id]?.needs ?? []) {
      if (hasCycle(dep)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  for (const id of jobIds) {
    if (hasCycle(id)) {
      errors.push("circular dependency detected in job needs");
      break;
    }
  }

  return errors;
}

// --- Default config generator ---

const STACK_CONFIGS: Record<string, { install: string; test: string }> = {
  node: { install: "npm ci", test: "npm test" },
  python: { install: "pip install -r requirements.txt", test: "pytest" },
  go: { install: "go mod download", test: "go test ./..." },
  rust: { install: "cargo fetch", test: "cargo test" },
  ruby: { install: "bundle install", test: "bundle exec rake test" },
  java: { install: "mvn dependency:resolve", test: "mvn test" },
  php: { install: "composer install", test: "vendor/bin/phpunit" },
  dotnet: { install: "dotnet restore", test: "dotnet test" },
  swift: { install: "swift package resolve", test: "swift test" },
  elixir: { install: "mix deps.get", test: "mix test" },
};

export function getDefaultConfig(stacks: string[]): string {
  const resolved = stacks.length ? stacks : ["node"];
  const jobs = resolved.map((stack) => {
    const cfg = STACK_CONFIGS[stack] ?? STACK_CONFIGS.node;
    return [
      `  ${stack}:`,
      `    name: ${stack} CI`,
      `    runs_on: local`,
      `    steps:`,
      `      - name: Install`,
      `        run: ${cfg.install}`,
      `      - name: Test`,
      `        run: ${cfg.test}`,
    ].join("\n");
  });

  return [
    "version: '1'",
    "name: CI Pipeline",
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "    branches: [main]",
    "jobs:",
    ...jobs,
  ].join("\n") + "\n";
}

// --- Hono route ---

export const pipelineConfigRoutes = new Hono<{ Bindings: Bindings }>();

pipelineConfigRoutes.post("/validate", async (c) => {
  const body = await c.req.json<{ yaml?: string }>();
  if (!body.yaml) return c.json({ error: "yaml field is required" }, 400);

  try {
    const config = parsePipelineConfig(body.yaml);
    const errors = validatePipelineConfig(config);
    return c.json({ valid: errors.length === 0, errors, config: errors.length === 0 ? config : undefined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "parse error";
    return c.json({ valid: false, errors: [msg] }, 400);
  }
});
