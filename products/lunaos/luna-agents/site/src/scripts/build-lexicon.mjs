#!/usr/bin/env node
// Reads ../../../commands/*.md, extracts frontmatter + first prose paragraph,
// emits ../data/skills.json, the real corpus that backs /lexicon.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const commandsDir = resolve(here, "../../../commands");
const agentsDir = resolve(here, "../../../agents");
const outFile = resolve(here, "../data/skills.json");

const files = readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
const agentSet = new Set(
  readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
);

// Status classifier. Returns one of:
//   stable   has agent, agent file exists, body has substance
//   beta     has agent, agent file exists, but body is thin
//   planned  references an agent that doesn't exist
//   stub     no agent referenced, no shortcut
//   aux      shortcut alias for another verb
//   unknown  malformed (no frontmatter)
function classifyStatus(fm, body, hasFrontmatter) {
  if (!hasFrontmatter) return "unknown";
  if (fm.shortcut_for) return "aux";
  const agent = fm.agent?.replace(/['"]/g, "").trim();
  if (!agent) return "stub";
  if (!agentSet.has(agent)) return "planned";
  const bodyLines = body.split("\n").filter((l) => l.trim()).length;
  return bodyLines > 30 ? "stable" : "beta";
}

// Heuristic capability manifest. Looks at frontmatter + body for signals
// indicating what a skill touches. Output shape mirrors the security model
// the user wants to surface: reads / writes / secrets / network.
const NETWORK_HINTS = /\b(api|http|fetch|webhook|github|gitlab|slack|notion|cloudflare|aws|deploy|publish|post|stripe|lemonsqueezy|figma|openai|anthropic|claude|gemini|deepseek)\b/i;
const FS_READ_HINTS = /\b(read|scan|analyz|audit|review|search|index|parse|load)\b/i;
const FS_WRITE_HINTS = /\b(write|generate|create|emit|produce|output|fix|patch|refactor|migrate|build|init)\b/i;
// Maps a provider name to the secret label we surface. We match the provider
// name followed (within ~30 chars) by "key" or "token" in description/body.
const SECRET_PROVIDERS = {
  openai: "openai_key",
  anthropic: "anthropic_key",
  claude: "anthropic_key",
  github: "github_token",
  gitlab: "gitlab_token",
  cloudflare: "cloudflare_token",
  notion: "notion_token",
  slack: "slack_token",
  stripe: "stripe_key",
  lemonsqueezy: "lemonsqueezy_key",
  figma: "figma_token",
  deepseek: "deepseek_key",
  gemini: "gemini_key",
};

function deriveCapabilities(fm, body) {
  const blob = `${fm.description ?? ""} ${body}`.toLowerCase();
  const reads = [];
  const writes = [];
  if (FS_READ_HINTS.test(blob)) reads.push("repo");
  if (FS_WRITE_HINTS.test(blob)) writes.push("repo");
  const network = NETWORK_HINTS.test(blob);
  if (network) reads.push("network");
  const secrets = [];
  for (const [provider, label] of Object.entries(SECRET_PROVIDERS)) {
    const re = new RegExp(`\\b${provider}\\b[\\s\\S]{0,40}\\b(key|token|secret|api)\\b`, "i");
    if (re.test(blob)) secrets.push(label);
  }
  // de-dupe + cap list size
  const u = (xs) => Array.from(new Set(xs)).slice(0, 4);
  return { reads: u(reads), writes: u(writes), network, secrets: u(secrets) };
}

function parseFrontmatter(src) {
  if (!src.startsWith("---")) return { fm: {}, body: src, hasFrontmatter: false };
  const end = src.indexOf("\n---", 3);
  if (end === -1) return { fm: {}, body: src, hasFrontmatter: false };
  const raw = src.slice(3, end).trim();
  const body = src.slice(end + 4).trim();
  const fm = {};
  let key = null;
  let val = "";
  for (const line of raw.split("\n")) {
    const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (m) {
      if (key !== null) fm[key] = val.trim();
      key = m[1];
      val = m[2];
    } else if (key !== null) {
      val += " " + line.trim();
    }
  }
  if (key !== null) fm[key] = val.trim();
  return { fm, body, hasFrontmatter: true };
}

function firstParagraph(body) {
  const trimmed = body.replace(/^#.*\n+/, "").trim();
  const para = trimmed.split(/\n\s*\n/)[0] ?? "";
  return para.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

// Brand rule: no em or en dashes in user-facing copy. Replace with comma+space.
function denormalizeDashes(s) {
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+--\s+/g, ", ")
    .replace(/, ,/g, ",")
    .replace(/,\s+,/g, ",");
}

function deriveCategory(fm, body) {
  const c = fm.category?.replace(/['"]/g, "").trim();
  if (c && c !== "shortcut") return c;
  if (fm.shortcut_for) return "shortcut";
  if (/security|owasp|threat/i.test(body)) return "security";
  if (/deploy|cloudflare|wrangler/i.test(body)) return "deployment";
  if (/test|playwright|jest/i.test(body)) return "testing";
  if (/landing|marketing|seo|brand|persona/i.test(body)) return "marketing";
  if (/design|ui|figma|hig/i.test(body)) return "design";
  if (/audit|review|critique/i.test(body)) return "review";
  if (/3d|video|image|imagine|voice|sing/i.test(body)) return "media";
  return "general";
}

const entries = [];
for (const file of files) {
  const path = join(commandsDir, file);
  const src = readFileSync(path, "utf8");
  const { fm, body, hasFrontmatter } = parseFrontmatter(src);
  const name = (fm.name || file.replace(/\.md$/, "")).replace(/['"]/g, "").trim();
  const display = (fm.displayName || name).replace(/['"]/g, "").trim();
  const description = denormalizeDashes(
    (fm.description || firstParagraph(body) || "").replace(/['"]/g, "").trim()
  );
  const category = deriveCategory(fm, body);
  const shortcutFor = fm.shortcut_for?.replace(/['"]/g, "").trim() || null;
  const status = classifyStatus(fm, body, hasFrontmatter);
  const caps = deriveCapabilities(fm, body);
  entries.push({
    word: name,
    display,
    gloss: description.slice(0, 200),
    category,
    shortcutFor,
    status,
    caps,
    call: shortcutFor ? `/${name}` : `/${name}`,
  });
}

entries.sort((a, b) => a.word.localeCompare(b.word));

const byCategory = {};
for (const e of entries) {
  if (!byCategory[e.category]) byCategory[e.category] = [];
  byCategory[e.category].push(e);
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify({ count: entries.length, byCategory, entries }, null, 2)
);
console.log(`lexicon built: ${entries.length} entries across ${Object.keys(byCategory).length} categories`);
