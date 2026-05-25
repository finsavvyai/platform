// Terraform HCL scanner — pure functions, no I/O.
//
// Runs in Cloudflare Workers (no Node APIs, no HCL parser dep).
// Uses regex/string walking which is good enough for the structural
// discovery we need: providers, modules, backend, variables,
// required_version. For the enterprise onboarding flow where teams
// bring their existing `.tf` files and want PushCI to produce a
// working pipeline in one click.

export interface TfProvider {
  name: string;
  source?: string;
  version?: string;
}

export interface TfModule {
  name: string;
  source: string;
  version?: string;
}

export interface TfBackend {
  type: string;
  config: Record<string, string>;
}

export interface TerraformScan {
  providers: TfProvider[];
  modules: TfModule[];
  backend?: TfBackend;
  requiredVersion?: string;
  variables: string[];
  workspaceHints: string[];
}

export interface TerraformFile {
  path: string;
  content: string;
}

// --- Preprocessing --------------------------------------------------------

/**
 * Strip comments and heredoc bodies from a .tf source. This is cheap
 * and leaves structural tokens like block openers/closers untouched
 * so downstream regex block extraction is not confused by strings or
 * commented-out code.
 */
export function preprocessHcl(src: string): string {
  // Strip `/* ... */` block comments first (non-greedy, multi-line).
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const lines = src.split("\n");
  const out: string[] = [];
  let inHeredoc = false;
  let heredocTag = "";
  for (const raw of lines) {
    if (inHeredoc) {
      // Heredoc terminator is the tag on its own line (optional
      // leading whitespace for `<<-` indented heredocs).
      if (raw.trim() === heredocTag) {
        inHeredoc = false;
        heredocTag = "";
      }
      out.push("");
      continue;
    }
    const trimmed = raw.trimStart();
    if (trimmed.startsWith("#") || trimmed.startsWith("//")) {
      out.push("");
      continue;
    }
    // Detect start of a heredoc: `... = <<EOT` or `<<-EOT`.
    const hd = raw.match(/<<-?([A-Za-z_][A-Za-z0-9_]*)\s*$/);
    if (hd) {
      inHeredoc = true;
      heredocTag = hd[1];
      out.push(raw.slice(0, hd.index));
      continue;
    }
    out.push(raw);
  }
  return out.join("\n");
}

// --- Block walker ---------------------------------------------------------

/**
 * Find every top-level block whose header matches `headerRe`. Returns
 * both the matched header groups and the inner body (content between
 * the opening `{` and its balanced `}`).
 */
function findBlocks(
  src: string,
  headerRe: RegExp,
): Array<{ header: RegExpExecArray; body: string }> {
  const out: Array<{ header: RegExpExecArray; body: string }> = [];
  const re = new RegExp(headerRe.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const braceStart = src.indexOf("{", m.index + m[0].length - 1);
    if (braceStart < 0) continue;
    let depth = 1;
    let i = braceStart + 1;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    if (depth !== 0) continue;
    out.push({ header: m, body: src.slice(braceStart + 1, i - 1) });
    re.lastIndex = i;
  }
  return out;
}

/** Extract quoted `key = "value"` assignments from a block body. */
function kvPairs(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out[m[1]] = m[2];
  }
  return out;
}

// --- Scanners -------------------------------------------------------------

function scanProviders(src: string): TfProvider[] {
  const out: TfProvider[] = [];
  // Walk `terraform { required_providers { xxx = { ... } } }` blocks.
  for (const tf of findBlocks(src, /terraform\s*\{/)) {
    for (const rp of findBlocks(tf.body, /required_providers\s*\{/)) {
      const re = /([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*\{/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(rp.body)) !== null) {
        const braceStart = m.index + m[0].length - 1;
        let depth = 1;
        let i = braceStart + 1;
        while (i < rp.body.length && depth > 0) {
          if (rp.body[i] === "{") depth++;
          else if (rp.body[i] === "}") depth--;
          i++;
        }
        const inner = rp.body.slice(braceStart + 1, i - 1);
        const kv = kvPairs(inner);
        out.push({ name: m[1], source: kv.source, version: kv.version });
        re.lastIndex = i;
      }
    }
  }
  // Also pick up legacy `provider "aws" { version = "..." }` blocks.
  for (const p of findBlocks(src, /provider\s+"([^"]+)"\s*\{/)) {
    const name = p.header[1];
    if (out.find((o) => o.name === name)) continue;
    const kv = kvPairs(p.body);
    out.push({ name, version: kv.version });
  }
  return out;
}

function scanModules(src: string): TfModule[] {
  const out: TfModule[] = [];
  for (const b of findBlocks(src, /module\s+"([^"]+)"\s*\{/)) {
    const kv = kvPairs(b.body);
    if (!kv.source) continue;
    out.push({ name: b.header[1], source: kv.source, version: kv.version });
  }
  return out;
}

function scanBackend(src: string): TfBackend | undefined {
  for (const tf of findBlocks(src, /terraform\s*\{/)) {
    for (const b of findBlocks(tf.body, /backend\s+"([^"]+)"\s*\{/)) {
      return { type: b.header[1], config: kvPairs(b.body) };
    }
  }
  return undefined;
}

function scanRequiredVersion(src: string): string | undefined {
  for (const tf of findBlocks(src, /terraform\s*\{/)) {
    const m = tf.body.match(/required_version\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  }
  return undefined;
}

function scanVariables(src: string): string[] {
  const out: string[] = [];
  const re = /variable\s+"([^"]+)"\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

function scanWorkspaceHints(src: string): string[] {
  const out: string[] = [];
  // `workspaces { name = "x" }` or `workspaces { prefix = "x-" }` inside
  // remote / cloud backends.
  for (const b of findBlocks(src, /workspaces\s*\{/)) {
    const kv = kvPairs(b.body);
    if (kv.name) out.push(kv.name);
    if (kv.prefix) out.push(kv.prefix + "*");
  }
  return out;
}

// --- Public entry ---------------------------------------------------------

/**
 * Scan a set of .tf files (from disk or an API payload) and aggregate
 * the interesting structure. Order of files is preserved for
 * deterministic output.
 */
export function scanTerraformFiles(files: TerraformFile[]): TerraformScan {
  const agg: TerraformScan = {
    providers: [],
    modules: [],
    variables: [],
    workspaceHints: [],
  };
  for (const f of files) {
    if (!f.path.endsWith(".tf") && !f.path.endsWith(".tf.json")) continue;
    const src = preprocessHcl(f.content);
    for (const p of scanProviders(src)) {
      if (!agg.providers.find((x) => x.name === p.name)) agg.providers.push(p);
    }
    for (const m of scanModules(src)) agg.modules.push(m);
    for (const v of scanVariables(src)) {
      if (!agg.variables.includes(v)) agg.variables.push(v);
    }
    for (const w of scanWorkspaceHints(src)) {
      if (!agg.workspaceHints.includes(w)) agg.workspaceHints.push(w);
    }
    if (!agg.backend) {
      const b = scanBackend(src);
      if (b) agg.backend = b;
    }
    if (!agg.requiredVersion) {
      const rv = scanRequiredVersion(src);
      if (rv) agg.requiredVersion = rv;
    }
  }
  return agg;
}
