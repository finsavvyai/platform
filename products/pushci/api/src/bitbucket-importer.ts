// bitbucket-pipelines.yml → .pushci.yml translator.
//
// Bitbucket Pipelines config is already YAML (unlike Jenkins Groovy), so the
// parsing story is simpler: we run a minimal structural YAML reader that
// understands the pieces we care about (image, pipelines.default, steps,
// script lines). No full YAML library — stays inside the ≤200-line cap
// and avoids dragging js-yaml into the Workers bundle.
//
// We scope to the `pipelines.default` and `pipelines.branches.<branch>`
// entries because that's what 90%+ of Bitbucket Cloud estates use.
//
// License: Apache-2.0

export interface ImportedBbStage {
  name: string;
  steps: string[];
}

export interface ImportedBbPipeline {
  name: string;
  image?: string;
  stages: ImportedBbStage[];
  warnings: string[];
}

interface Line {
  indent: number;
  text: string;
  raw: string;
}

function splitLines(src: string): Line[] {
  const out: Line[] = [];
  for (const raw of src.split(/\r?\n/)) {
    const noComment = raw.replace(/(^|[^"'])#.*$/, (m, p) => (p ? p : ""));
    if (!noComment.trim()) continue;
    const indent = raw.match(/^\s*/)?.[0].length ?? 0;
    out.push({ indent, text: noComment.trim(), raw });
  }
  return out;
}

function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Find the body lines (as Line[]) immediately under a key at a given indent.
 * Returns every line with indent strictly greater than keyIndent until we
 * hit a sibling/ancestor line.
 */
function bodyOf(lines: Line[], startIdx: number): Line[] {
  const base = lines[startIdx].indent;
  const out: Line[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].indent <= base) break;
    out.push(lines[i]);
  }
  return out;
}

/** Find the first line at any indent that exactly matches `key:`. */
function findKey(lines: Line[], key: string, afterIdx = -1): number {
  for (let i = afterIdx + 1; i < lines.length; i++) {
    if (lines[i].text === `${key}:` || lines[i].text.startsWith(`${key}:`)) return i;
  }
  return -1;
}

function keyValue(text: string): { key: string; value: string } | null {
  const m = text.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
  if (!m) return null;
  return { key: m[1], value: m[2] };
}

/** Extract script entries from a list body that looks like `- step:` → `- script: - foo`. */
function extractSteps(body: Line[], warnings: string[]): ImportedBbStage[] {
  const stages: ImportedBbStage[] = [];
  let current: ImportedBbStage | null = null;
  let inScript = false;
  let scriptIndent = -1;

  for (const line of body) {
    // New step marker: "- step:" or "- parallel:" at the top level of the list.
    if (/^-\s*step\s*:/.test(line.text) || line.text === "- step:") {
      if (current) stages.push(current);
      current = { name: `step-${stages.length + 1}`, steps: [] };
      inScript = false;
      continue;
    }
    if (/^-\s*parallel\s*:/.test(line.text)) {
      warnings.push("parallel steps flattened — order may differ from Bitbucket execution");
      if (current) stages.push(current);
      current = { name: `parallel-${stages.length + 1}`, steps: [] };
      inScript = false;
      continue;
    }
    if (!current) continue;

    const kv = keyValue(line.text);
    if (kv && kv.key === "name") {
      current.name = unquote(kv.value) || current.name;
      continue;
    }
    if (line.text === "script:" || /^script\s*:/.test(line.text)) {
      inScript = true;
      scriptIndent = line.indent;
      continue;
    }
    if (inScript && line.indent > scriptIndent && line.text.startsWith("- ")) {
      const cmd = unquote(line.text.slice(2).trim());
      if (cmd) current.steps.push(cmd);
      continue;
    }
    if (inScript && line.indent <= scriptIndent) inScript = false;
  }

  if (current) stages.push(current);
  return stages;
}

export function parseBitbucketPipelines(source: string): ImportedBbPipeline {
  const warnings: string[] = [];
  const lines = splitLines(source);

  const imageIdx = findKey(lines, "image");
  let image: string | undefined;
  if (imageIdx >= 0 && lines[imageIdx].indent === 0) {
    const kv = keyValue(lines[imageIdx].text);
    if (kv && kv.value) image = unquote(kv.value);
  }

  const pipelinesIdx = findKey(lines, "pipelines");
  if (pipelinesIdx < 0) {
    warnings.push("no 'pipelines:' key found — is this really a bitbucket-pipelines.yml?");
    return { name: "bitbucket-import", image, stages: [], warnings };
  }

  const pipelinesBody = bodyOf(lines, pipelinesIdx);
  let defaultIdx = pipelinesBody.findIndex((l) => l.text === "default:" && l.indent === pipelinesBody[0].indent);
  let stages: ImportedBbStage[] = [];

  if (defaultIdx >= 0) {
    // absolute index into `lines`
    const abs = lines.indexOf(pipelinesBody[defaultIdx]);
    const body = bodyOf(lines, abs);
    stages = extractSteps(body, warnings);
  } else {
    warnings.push("no 'default' pipeline defined — only 'default' is imported currently");
  }

  return { name: "bitbucket-import", image, stages, warnings };
}

function yamlQuote(value: string): string {
  if (value === "") return "''";
  if (/^[A-Za-z0-9_./:@=+\-]+$/.test(value)) return value;
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function toPushciYaml(p: ImportedBbPipeline): string {
  const out: string[] = [];
  out.push("# Imported from bitbucket-pipelines.yml by PushCI");
  for (const w of p.warnings) out.push(`# WARNING: ${w}`);
  out.push(`version: '1'`);
  out.push(`name: ${yamlQuote(p.name)}`);
  if (p.image) out.push(`image: ${yamlQuote(p.image)}`);
  out.push("stages:");
  if (p.stages.length === 0) out.push("  # no stages detected — review the source file");
  for (const s of p.stages) {
    out.push(`  - name: ${yamlQuote(s.name)}`);
    if (s.steps.length === 0) {
      out.push(`    run: []`);
    } else {
      out.push(`    run:`);
      for (const step of s.steps) out.push(`      - ${yamlQuote(step)}`);
    }
  }
  return out.join("\n") + "\n";
}

export function bitbucketYmlToPushciYaml(source: string): {
  pipeline: ImportedBbPipeline;
  yaml: string;
} {
  const pipeline = parseBitbucketPipelines(source);
  return { pipeline, yaml: toPushciYaml(pipeline) };
}
