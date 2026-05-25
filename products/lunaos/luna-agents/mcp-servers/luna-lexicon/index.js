#!/usr/bin/env node
// Luna Lexicon MCP server.
// Exposes the 277-entry Luna Pipes lexicon as discoverable tools so any
// MCP-compatible AI client (Claude Desktop, Cursor, Windsurf) can browse,
// inspect, and compose Luna Pipes natively, without the user knowing the
// pipe syntax.
//
// Tools exposed:
//   list_skills   — browse the lexicon, optionally filtered by category/status
//   get_skill     — fetch one skill's full record (gloss, caps, status, etc.)
//   compose_pipe  — given a goal in natural language, suggest a pipe expression
//                   built from skills in the lexicon
//   run_skill     — placeholder. Real execution requires the `luna` CLI on PATH;
//                   v1 returns a dry-run plan instead of executing.
//
// stdio transport. No network access. Skills are loaded from
//   site/src/data/skills.json (built by site/src/scripts/build-lexicon.mjs)

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lexiconPath = resolve(here, "../../site/src/data/skills.json");

function loadLexicon() {
  const raw = readFileSync(lexiconPath, "utf8");
  const data = JSON.parse(raw);
  // entries[] is the canonical list; byCategory mirrors it
  const entries = data.entries ?? Object.values(data.byCategory ?? {}).flat();
  return { entries, count: data.count ?? entries.length };
}

function asJson(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function asText(text) {
  return { content: [{ type: "text", text }] };
}

const TOOLS = [
  {
    name: "list_skills",
    description: "Browse the Luna Pipes lexicon. Returns a flat list of skill records with word, category, gloss, status (stable/beta/planned/aux), and capability manifest (reads/writes/network/secrets). Use this first when a user wants to know what's available.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter to a category (e.g. 'security', 'deployment', 'design')" },
        status:   { type: "string", description: "Filter by impl status: stable, beta, planned, aux" },
        query:    { type: "string", description: "Free-text substring match against word + gloss" },
        limit:    { type: "number", description: "Cap result count (default 50)" },
      },
    },
  },
  {
    name: "get_skill",
    description: "Fetch one skill's full record by word. Returns gloss, category, status, capability manifest, shortcut alias (if any), and the canonical call signature.",
    inputSchema: {
      type: "object",
      properties: {
        word: { type: "string", description: "The skill's word, e.g. 'll-deploy' or 'security'" },
      },
      required: ["word"],
    },
  },
  {
    name: "compose_pipe",
    description: "Given a plain-language goal, suggest a Luna Pipe expression that composes lexicon skills. Returns the pipe string and the rationale (which skills were chosen and why). This is the AI's path to writing pipes for users who don't know the syntax.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "What the user wants done, e.g. 'audit my repo and open a PR with fixes'" },
      },
      required: ["goal"],
    },
  },
  {
    name: "run_skill",
    description: "Dry-run plan for executing a skill. v1 does NOT shell out to the luna CLI; it returns the call signature and capability manifest so the AI client can show the user exactly what would happen before any real execution.",
    inputSchema: {
      type: "object",
      properties: {
        word: { type: "string", description: "The skill's word" },
        args: { type: "array", items: { type: "string" }, description: "Optional positional args" },
      },
      required: ["word"],
    },
  },
];

function findSkill(entries, word) {
  const w = word.toLowerCase();
  return entries.find((e) => e.word.toLowerCase() === w) ?? null;
}

function handleList(entries, args) {
  let out = entries;
  if (args.category) out = out.filter((e) => e.category === args.category);
  if (args.status)   out = out.filter((e) => e.status === args.status);
  if (args.query) {
    const q = String(args.query).toLowerCase();
    out = out.filter((e) =>
      e.word.toLowerCase().includes(q) || (e.gloss ?? "").toLowerCase().includes(q)
    );
  }
  const limit = Math.max(1, Math.min(500, args.limit ?? 50));
  return asJson({ total: out.length, returned: Math.min(out.length, limit), skills: out.slice(0, limit) });
}

function handleGet(entries, args) {
  const e = findSkill(entries, args.word);
  if (!e) return asText(`No skill named "${args.word}". Try list_skills to browse.`);
  return asJson(e);
}

// Naive keyword-based composer. Good enough for v1; the AI client itself
// produces the real composition, this just narrows the candidate set.
const TOPIC_KEYWORDS = {
  security:   ["security", "scan", "fix", "create pr"],
  deploy:     ["deploy", "lint", "code-review"],
  content:    ["persona generate", "ghost", "publish notion"],
  research:   ["research competitor", "summarize"],
  triage:     ["github issues", "summarize"],
};

function handleCompose(entries, args) {
  const goal = String(args.goal ?? "").toLowerCase();
  const candidates = new Set();
  for (const [topic, verbs] of Object.entries(TOPIC_KEYWORDS)) {
    if (goal.includes(topic)) verbs.forEach((v) => candidates.add(v));
  }
  if (candidates.size === 0) {
    // fall back: top-of-mind verbs by category match
    const stable = entries.filter((e) => e.status === "stable").slice(0, 10);
    return asJson({
      pipe: null,
      rationale: "No strong topic match. Inspect candidate skills and pick yours.",
      candidates: stable.map((e) => ({ word: e.word, gloss: e.gloss })),
    });
  }
  const pipe = [...candidates].join(" >> ");
  return asJson({
    pipe,
    rationale: `Matched topic keywords in goal. Composed ${candidates.size} stages.`,
    note: "Refine by inspecting each verb with get_skill before running.",
  });
}

function handleRun(entries, args) {
  const e = findSkill(entries, args.word);
  if (!e) return asText(`No skill named "${args.word}".`);
  const argText = (args.args ?? []).map((a) => /\s/.test(a) ? `"${a}"` : a).join(" ");
  return asJson({
    plan: "dry-run",
    call: `/${e.word}${argText ? " " + argText : ""}`,
    status: e.status,
    capabilities: e.caps,
    gloss: e.gloss,
    note: "This is a dry-run. v1 of luna-lexicon MCP does not invoke the runtime. To execute, install `luna-agents` and run the call above in a shell or Claude Code.",
  });
}

async function main() {
  const { entries, count } = loadLexicon();
  const server = new Server(
    { name: "luna-lexicon", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = req.params.arguments ?? {};
    switch (req.params.name) {
      case "list_skills":  return handleList(entries, args);
      case "get_skill":    return handleGet(entries, args);
      case "compose_pipe": return handleCompose(entries, args);
      case "run_skill":    return handleRun(entries, args);
      default:             return asText(`Unknown tool: ${req.params.name}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`luna-lexicon MCP ready. ${count} skills loaded from ${lexiconPath}.`);
}

main().catch((err) => {
  console.error("luna-lexicon MCP fatal:", err);
  process.exit(1);
});
