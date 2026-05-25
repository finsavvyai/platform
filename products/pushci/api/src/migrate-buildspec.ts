// AWS CodeBuild buildspec.yml → PushCI pipeline converter.
//
// Mirrors the Go-side logic under `internal/migrate/` — kept in sync so
// the dashboard paste-import experience matches `pushci migrate` on the
// CLI. No external dependencies: we reuse the minimal structural YAML
// reader patterns from `bitbucket-importer.ts` to stay inside the
// Workers bundle budget and avoid pulling js-yaml at runtime.
//
// License: Apache-2.0

import { yamlList as emitYamlList } from "./yaml-emit";

export interface EnvVarRef {
  name: string;
  suggestion: string;
  isSecret: boolean;
}

export interface BuildspecConvertResult {
  pushciYaml: string;
  warnings: string[];
  envVarsNeeded: EnvVarRef[];
}

interface Line {
  indent: number;
  text: string;
}

const PHASES = ["install", "pre_build", "build", "post_build"];

function splitLines(src: string): Line[] {
  const out: Line[] = [];
  for (const raw of src.split(/\r?\n/)) {
    // Strip # comments outside quoted strings. Cheap heuristic that
    // covers 99% of buildspecs — matches the bitbucket importer.
    const noComment = raw.replace(/(^|[^"'])#.*$/, (_m, p) => (p ? p : ""));
    if (!noComment.trim()) continue;
    const indent = raw.match(/^\s*/)?.[0].length ?? 0;
    out.push({ indent, text: noComment.trim() });
  }
  return out;
}

function bodyOf(lines: Line[], startIdx: number): Line[] {
  const base = lines[startIdx].indent;
  const out: Line[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].indent <= base) break;
    out.push(lines[i]);
  }
  return out;
}

function findKey(lines: Line[], key: string, afterIdx = -1): number {
  for (let i = afterIdx + 1; i < lines.length; i++) {
    const t = lines[i].text;
    if (t === `${key}:` || t.startsWith(`${key}:`)) return i;
  }
  return -1;
}

function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function collectCommands(body: Line[]): string[] {
  const cmds: string[] = [];
  let inCommands = false;
  let cmdBaseIndent = -1;
  for (const line of body) {
    if (/^commands\s*:/.test(line.text)) {
      inCommands = true;
      cmdBaseIndent = line.indent;
      continue;
    }
    if (inCommands && line.indent <= cmdBaseIndent) {
      inCommands = false;
    }
    if (inCommands && line.text.startsWith("- ")) {
      cmds.push(unquote(line.text.slice(2)));
    }
  }
  return cmds;
}

function extractEnvVars(lines: Line[]): EnvVarRef[] {
  const refs: EnvVarRef[] = [];
  const envIdx = findKey(lines, "env");
  if (envIdx < 0) return refs;
  const envBody = bodyOf(lines, envIdx);

  for (let i = 0; i < envBody.length; i++) {
    const line = envBody[i];
    if (/^variables\s*:/.test(line.text)) {
      const block = bodyOf(envBody, i);
      for (const item of block) {
        const m = item.text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
        if (m) {
          refs.push({
            name: m[1],
            suggestion: `pushci secret set ${m[1]} <value>`,
            isSecret: false,
          });
        }
      }
    }
    if (/^(secrets-manager|parameter-store)\s*:/.test(line.text)) {
      const block = bodyOf(envBody, i);
      for (const item of block) {
        const m = item.text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
        if (m) {
          refs.push({
            name: m[1],
            suggestion: `pushci secret set ${m[1]} <value>   # was AWS secret`,
            isSecret: true,
          });
        }
      }
    }
  }
  return refs;
}

// yamlList re-exports the shared emitter so phase bodies get
// YAML-spec-correct escaping (see M-006, v1.6.6 audit).
const yamlList = emitYamlList;

export function convertBuildspec(yamlText: string): BuildspecConvertResult {
  const warnings: string[] = [];
  const lines = splitLines(yamlText);
  if (lines.length === 0) {
    warnings.push("empty buildspec input");
    return { pushciYaml: "", warnings, envVarsNeeded: [] };
  }

  const envVarsNeeded = extractEnvVars(lines);

  const phasesIdx = findKey(lines, "phases");
  if (phasesIdx < 0) {
    warnings.push("no 'phases:' key found — is this really a buildspec.yml?");
  }

  const stageBlocks: string[] = [];
  if (phasesIdx >= 0) {
    const phasesBody = bodyOf(lines, phasesIdx);
    for (const phase of PHASES) {
      const phaseLine = phasesBody.find(
        (l) => l.text === `${phase}:` || l.text.startsWith(`${phase}:`)
      );
      if (!phaseLine) continue;
      const phaseStart = lines.indexOf(phaseLine);
      const phaseBody = bodyOf(lines, phaseStart);
      const cmds = collectCommands(phaseBody);
      if (cmds.length === 0) continue;
      stageBlocks.push(`  - name: ${phase}\n    run:\n${yamlList(cmds, "      ")}`);
    }
  }

  const artifactsIdx = findKey(lines, "artifacts");
  if (artifactsIdx >= 0) {
    warnings.push("`artifacts:` block detected — wire via `pushci artifacts` after review");
  }
  if (stageBlocks.length === 0) {
    warnings.push("no commands extracted — buildspec may be empty or use unsupported shape");
  }

  const header = [
    "# Imported from AWS CodeBuild buildspec.yml by PushCI",
    ...warnings.map((w) => `# WARNING: ${w}`),
    "version: '1'",
    "stages:",
  ].join("\n");

  const pushciYaml =
    stageBlocks.length > 0 ? `${header}\n${stageBlocks.join("\n")}\n` : `${header}\n`;

  return { pushciYaml, warnings, envVarsNeeded };
}
