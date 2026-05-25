// Tiny indent-aware YAML tokenizer for azure-pipelines.yml.
//
// Only supports the subset azure-pipelines files actually use:
// - `key: value` pairs
// - `- key: value` list items with nested maps
// - quoted scalars ("" and '')
// No anchors, tags, flow style, or merge keys — those produce warnings in
// the importer layer. Split into its own file to keep both the importer
// and this tokenizer under 200 lines each.
//
// License: Apache-2.0

export interface Line {
  indent: number;
  text: string;
  raw: string;
}

export function tokenize(src: string): Line[] {
  const out: Line[] = [];
  for (const raw of src.split(/\r?\n/)) {
    const stripped = raw.replace(/\s+#.*$/, "");
    if (/^\s*#/.test(stripped) || stripped.trim() === "") continue;
    const m = stripped.match(/^(\s*)(.*)$/);
    if (!m) continue;
    out.push({ indent: m[1].length, text: m[2], raw });
  }
  return out;
}

export function unquote(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Split a set of indented lines into groups, one per top-level `- ...`
 * list item at `baseIndent`. Subsequent lines with deeper indent attach to
 * the preceding item. The leading `- ` is stripped from the head line.
 */
export function splitByListItems(lines: Line[], baseIndent: number): Line[][] {
  const groups: Line[][] = [];
  let current: Line[] | null = null;
  for (const ln of lines) {
    if (ln.indent === baseIndent && ln.text.startsWith("- ")) {
      if (current) groups.push(current);
      current = [{ ...ln, text: ln.text.replace(/^-\s*/, "") }];
    } else if (current && ln.indent > baseIndent) {
      current.push(ln);
    }
  }
  if (current) groups.push(current);
  return groups;
}

/**
 * Group lines into sections keyed by their unindented header, e.g.
 * `variables:`, `stages:`, `jobs:`, `steps:`. Lines until the next
 * unindented header belong to the current section.
 */
export function topSections(lines: Line[]): Record<string, Line[]> {
  const sections: Record<string, Line[]> = {};
  let current: string | null = null;
  for (const ln of lines) {
    if (ln.indent === 0 && /^[A-Za-z_]+:\s*$/.test(ln.text)) {
      current = ln.text.replace(/:\s*$/, "").trim();
      sections[current] = [];
      continue;
    }
    if (current) sections[current].push(ln);
  }
  return sections;
}

export function yamlQuote(v: string): string {
  if (v === "") return "''";
  if (/^[A-Za-z0-9_./:@=+\-]+$/.test(v)) return v;
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
