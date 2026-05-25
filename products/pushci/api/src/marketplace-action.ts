// Marketplace action resolver — parses org/repo[/subpath]@ref, fetches the
// action.yml from raw.githubusercontent.com, and pulls the `inputs:` block
// for the dashboard `with:` form. Route wiring lives in marketplace-routes.
// Security: every ref passes through marketplace-action-validate (M-001).
import { validateParts, canonicalRawUrl, type RefParts } from "./marketplace-action-validate";

export interface ActionInput {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
  readonly default: string | null;
}

export interface ResolvedAction {
  readonly ref: string;
  readonly owner: string;
  readonly repo: string;
  readonly subpath: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly inputs: ActionInput[];
  readonly warnings: string[];
  readonly sourceUrl: string;
}

export type ParseResult = RefParts;

const MARKETPLACE_RE = /^https?:\/\/github\.com\/marketplace\/actions\/([^/?#]+)/i;

// parseActionRef normalizes the many shapes a user might paste. Marketplace
// URLs aren't 1:1 with repos so we return null and let the caller prompt.
// Splits on the LAST `@` so refs containing `@` themselves are still
// accepted, then hands off to validateParts (see marketplace-action-validate)
// for the actual security-critical checks.
export function parseActionRef(input: string): ParseResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/[\s\u0000-\u001f\u007f-\uffff]/.test(trimmed)) return null;
  if (MARKETPLACE_RE.exec(trimmed)) return null;
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const path = trimmed.slice(0, at);
  const version = trimmed.slice(at + 1);
  const segments = path.split("/");
  if (segments.length < 2) return null;
  const [owner, repo, ...rest] = segments;
  const subpath = rest.join("/");
  const parts: ParseResult = { owner, repo, subpath, version };
  if (!validateParts(parts)) return null;
  return parts;
}

export function buildRawUrl(
  parsed: ParseResult,
  filename: "action.yml" | "action.yaml",
): string {
  const path = parsed.subpath ? `${parsed.subpath}/${filename}` : filename;
  return `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${parsed.version}/${path}`;
}

// fetchActionYaml tries action.yml, then action.yaml. Throws if neither
// file exists (common for docker-only actions). Each candidate URL is
// re-parsed with WHATWG URL and checked for traversal before the
// network call fires.
export async function fetchActionYaml(
  parsed: ParseResult,
  fetchImpl: typeof fetch = fetch,
): Promise<{ yaml: string; url: string }> {
  for (const name of ["action.yml", "action.yaml"] as const) {
    const raw = buildRawUrl(parsed, name);
    const url = canonicalRawUrl(raw);
    if (!url) {
      throw new Error(`refused non-canonical URL for ${parsed.owner}/${parsed.repo}`);
    }
    const res = await fetchImpl(url, { headers: { accept: "text/plain" } });
    if (res.ok) return { yaml: await res.text(), url };
  }
  throw new Error(
    `no action.yml or action.yaml at ${parsed.owner}/${parsed.repo}` +
      (parsed.subpath ? `/${parsed.subpath}` : "") + `@${parsed.version}`,
  );
}

// parseActionYaml reads only top-level `name`, `description`, and the
// `inputs:` block. A full YAML parser would bloat the worker bundle; this
// covers 99% of actions in the wild and is easy to audit.
export function parseActionYaml(raw: string): {
  name: string;
  description: string;
  inputs: ActionInput[];
} {
  const lines = raw.split(/\r?\n/);
  let name = "";
  let description = "";
  const inputs: ActionInput[] = [];
  let inInputs = false;
  let current: { name: string; fields: Record<string, string> } | null = null;

  const flush = (): void => {
    if (!current) return;
    inputs.push({
      name: current.name,
      description: current.fields.description ?? "",
      required: (current.fields.required ?? "").toLowerCase() === "true",
      default: current.fields.default ?? null,
    });
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    if (!inInputs) {
      const topName = /^name:\s*(.*)$/.exec(line);
      const topDesc = /^description:\s*(.*)$/.exec(line);
      if (topName) name = unquote(topName[1]);
      else if (topDesc) description = unquote(topDesc[1]);
      else if (/^inputs:\s*$/.test(line)) inInputs = true;
      continue;
    }
    if (/^[A-Za-z0-9_-]+:/.test(line) && !/^inputs:/.test(line)) {
      flush();
      inInputs = false;
      continue;
    }
    const header = /^  ([A-Za-z0-9_.-]+):\s*$/.exec(line);
    if (header) {
      flush();
      current = { name: header[1], fields: {} };
      continue;
    }
    const field = /^    ([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (field && current) current.fields[field[1]] = unquote(field[2]);
  }
  flush();
  return { name: name || "unnamed action", description, inputs };
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && (t.startsWith('"') || t.startsWith("'"))) {
    const q = t[0];
    if (t.endsWith(q)) return t.slice(1, -1);
  }
  return t;
}

// resolveAction is the public entry point used by the HTTP route.
export async function resolveAction(
  ref: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedAction> {
  const parsed = parseActionRef(ref);
  if (!parsed) {
    throw new Error(
      `unrecognized action ref "${ref}" — expected owner/repo@ref or owner/repo/subpath@ref`,
    );
  }
  const { yaml, url } = await fetchActionYaml(parsed, fetchImpl);
  const meta = parseActionYaml(yaml);
  const warnings: string[] = [];
  if (meta.inputs.length === 0) {
    warnings.push("action declares no inputs — may be a Docker/JS action without documented parameters");
  }
  return {
    ref, owner: parsed.owner, repo: parsed.repo, subpath: parsed.subpath,
    version: parsed.version, name: meta.name, description: meta.description,
    inputs: meta.inputs, warnings, sourceUrl: url,
  };
}

// renderStageYaml produces a pushci.yml snippet for the resolved action.
export function renderStageYaml(
  resolved: ResolvedAction,
  values: Record<string, string>,
): string {
  const uses =
    `${resolved.owner}/${resolved.repo}${resolved.subpath ? "/" + resolved.subpath : ""}@${resolved.version}`;
  const lines = [`- name: ${safeStageName(resolved)}`, `  uses: ${uses}`];
  const withEntries = Object.entries(values).filter(([, v]) => v !== "");
  if (withEntries.length > 0) {
    lines.push("  with:");
    for (const [k, v] of withEntries) lines.push(`    ${k}: ${quoteScalar(v)}`);
  }
  return lines.join("\n") + "\n";
}

function safeStageName(r: ResolvedAction): string {
  return (r.name || r.repo).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function quoteScalar(v: string): string {
  if (/^[A-Za-z0-9_.\-/]+$/.test(v)) return `'${v}'`;
  return JSON.stringify(v);
}
