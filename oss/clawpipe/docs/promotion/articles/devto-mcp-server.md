---
title: "Adding 12 cost-aware tools to Claude Desktop with one MCP server"
published: false
description: "ClawPipe ships an MCP server that exposes its pipeline as tools to Claude Desktop, Cursor, and Continue.dev — including 6 security analyst skills (reasoning, triage, remediation, compliance, threat-intel, incident) and 2 ticketing integrations (Jira, Notion). 5-minute setup."
tags: mcp, claude, ai, productivity
cover_image: https://clawpipe.ai/blog/covers/mcp-server.png
canonical_url: https://clawpipe.ai/blog/clawpipe-mcp-server
---

## What you'll have at the end of this post

A working MCP server in your Claude Desktop config that exposes 12
tools:

- `clawpipe_prompt` — route a prompt through the cost-optimized
  pipeline (Booster -> Pack -> Cache -> Route -> Call -> Learn)
- `clawpipe_analyze_cost` — estimate cost without sending the
  prompt; shows token count, per-model cost projections, and
  potential Booster/Packer savings
- `clawpipe_stats` — current session telemetry: total requests,
  tokens, cost, cache hit rate, top models, average latency
- `clawpipe_booster_check` — ask "would Booster catch this?" before
  paying for tokens
- `clawpipe_skill_reasoning` — root-cause + risk-score a security
  finding
- `clawpipe_skill_triage` — prioritize a batch of security findings
  by exploitability
- `clawpipe_skill_remediation` — generate fix + rollback for a
  vulnerability
- `clawpipe_skill_compliance` — write SOC 2 / ISO 27001 / HIPAA /
  GDPR audit evidence
- `clawpipe_skill_threat_intel` — enrich CVE / IOC with NVD/CIRCL
  context
- `clawpipe_skill_incident` — reconstruct an attack chain + suggest
  containment steps
- `clawpipe_report_to_jira` — create a Jira issue from a budget
  breach or anomaly
- `clawpipe_report_to_notion` — append a Notion page for cost
  digests or incident logs

Total install time: 5 minutes.

## Step 1: install the npm package

```bash
npm install -g clawpipe-mcp-server
```

The package is 100% TypeScript, ships precompiled CJS for Node 18+,
and has two runtime dependencies: `@modelcontextprotocol/sdk` and
`clawpipe-ai`. No native modules. Cross-platform.

## Step 2: get a ClawPipe API key

Go to [app.clawpipe.ai/signup](https://app.clawpipe.ai/signup) — free
tier, 1,000 calls/day, no card required. Copy the API key from the
dashboard. It looks like `cp_live_...` (or `cp_test_...` for sandbox).

## Step 3: wire it into Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`
on macOS or `%APPDATA%/Claude/claude_desktop_config.json` on Windows.
Add an entry under `mcpServers`:

```json
{
  "mcpServers": {
    "clawpipe": {
      "command": "npx",
      "args": ["-y", "clawpipe-mcp-server"],
      "env": {
        "CLAWPIPE_API_KEY": "cp_live_yourkeyhere",
        "CLAWPIPE_PROJECT_ID": "default"
      }
    }
  }
}
```

Restart Claude Desktop. The 12 tools will be available in any chat
under the MCP indicator (the little plug icon in the bottom-left).

## Step 4: ask it something

In Claude Desktop, try:

> "Use clawpipe_booster_check to see if 'convert 5 km to miles'
> would be resolved without an LLM call."

Claude will invoke the tool. The Booster will respond instantly:

```
{
  "boosterHit": true,
  "rule": "unit_conversion",
  "result": "3.10685596 miles",
  "latencyMs": 0.4
}
```

Try the cost analyzer:

> "Estimate the cost of asking gpt-4o to summarize a 6,000-token PDF
> using clawpipe_analyze_cost."

```
{
  "tokensIn": 6000,
  "candidates": [
    { "provider": "openai",    "model": "gpt-4o-mini",   "estimatedUsd": 0.0009 },
    { "provider": "anthropic", "model": "claude-haiku",  "estimatedUsd": 0.0015 },
    { "provider": "groq",      "model": "llama-70b",     "estimatedUsd": 0.0035 },
    { "provider": "openai",    "model": "gpt-4o",        "estimatedUsd": 0.0150 }
  ],
  "boosterCanResolve": false,
  "packerSavings": "estimated 18% token reduction available"
}
```

## Step 5: same config in Cursor and Continue.dev

**Cursor**: Settings → MCP → add a new server with command `npx`
args `["-y", "clawpipe-mcp-server"]`. Paste the same env vars.

**Continue.dev**: edit `~/.continue/config.json` and add:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "clawpipe-mcp-server"],
          "env": {
            "CLAWPIPE_API_KEY": "cp_live_yourkeyhere"
          }
        }
      }
    ]
  }
}
```

## Why these 12 tools

The first four (`prompt`, `analyze_cost`, `stats`, `booster_check`)
are direct exposure of the pipeline — useful for any prompt-heavy
workflow.

The six `skill_*` tools are domain-specialized prompts pre-baked
with a security-analyst persona. They're not separate models; they
route through the same pipeline with task-specific system prompts
and validation. The reason they exist as separate MCP tools instead
of a single "ask the model" tool is that they let *Claude* choose the
right one based on the task at hand. "Triage these findings" lights
up `clawpipe_skill_triage`. "Why does this matter" lights up
`clawpipe_skill_reasoning`. Better tool selection beats bigger system
prompts.

The two `report_to_*` tools (Jira, Notion) close the loop. The
typical workflow is:

> Claude triages findings (skill_triage) → writes a remediation plan
> (skill_remediation) → files a Jira ticket (report_to_jira) and
> appends a Notion page (report_to_notion).

That's a "give Claude a security analyst's job" pattern in three
tools. Other workflows: budget breach → report_to_jira; cost spike
detected by anomaly → report_to_notion as a digest.

## What's under the hood

The MCP server is small. The whole `src/` is ~500 lines:

```
mcp-server/src/
├── index.ts            (server setup + tool registration)
├── pipeline.ts         (lazy-init ClawPipe SDK with env config)
├── tool-prompt.ts
├── tool-analyze-cost.ts
├── tool-stats.ts
├── tool-booster-check.ts
├── tool-skills.ts      (the 6 skill_* tools)
├── tool-jira.ts
└── tool-notion.ts
```

Each tool is a thin wrapper around an SDK method. The MCP protocol
layer is provided by `@modelcontextprotocol/sdk`. Validation is
zod-schema. There are no DB connections; Jira and Notion calls hit
their own APIs directly with credentials passed via env (`JIRA_*`,
`NOTION_*`).

If you want to fork it for your own SDK, the pattern is reusable:

```ts
// src/index.ts (simplified)
const server = new McpServer({ name: 'clawpipe', version: '3.2.0' });
const pipeline = createPipeline(env.CLAWPIPE_API_KEY, env.CLAWPIPE_PROJECT_ID);

registerPromptTool(server, pipeline);
registerAnalyzeCostTool(server, pipeline);
registerStatsTool(server, pipeline);
registerBoosterCheckTool(server, pipeline);
registerJiraTool(server);
registerNotionTool(server);
registerSkillTools(server, pipeline);

const transport = new StdioServerTransport();
await server.connect(transport);
```

That's the whole entrypoint. The `register*Tool` functions each call
`server.tool(name, description, inputSchema, handler)` once.

## Manifest tests

We ship a `manifest.test.ts` that asserts the `mcp.json` and
`server.json` files match what `index.ts` actually registers. If
you add a tool to `index.ts` and forget to update the manifests, the
test fails:

```ts
const REGISTERED_TOOLS = [
  'clawpipe_prompt',
  'clawpipe_analyze_cost',
  // ... 10 more
];

it('declares every tool the server registers', () => {
  const declared = mcpJson.capabilities.tools.map((t) => t.name);
  for (const name of REGISTERED_TOOLS) {
    expect(declared).toContain(name);
  }
});
```

Small thing, saves a class of bugs that would otherwise only surface
in the MCP discovery flow at runtime.

## Where to get it

- npm: `clawpipe-mcp-server`
- repo: github.com/finsavvyai/clawpipe (subfolder: `mcp-server/`)
- Anthropic MCP registry: `io.github.finsavvyai/clawpipe-mcp-server`
- discovery: `https://clawpipe.ai/.well-known/mcp.json`

The server is MIT-licensed. If you build something on top, drop a
link.
