# ClawPipe × Cepien AI — Integration Spec

Two directions. Each ship-able independently.

## Direction A: Cepien wraps ClawPipe (inbound)

**Change in Cepien**: one line in their Gemini client.

```ts
// before
const client = new GoogleGenerativeAI(GEMINI_KEY);

// after — via ClawPipe OpenAI-compatible endpoint
import { ClawPipe } from 'clawpipe-ai';
const pipe = new ClawPipe({
  apiKey: process.env.CLAWPIPE_API_KEY,
  projectId: 'cepien-aether',
});
await pipe.prompt(prompt, { provider: 'gemini', model: 'gemini-2.0-flash' });
```

**Effect**: every Aether LLM call first hits Booster (skip if deterministic),
then Packer (shrink context), then Cache (semantic hit), then Router
(pick cheapest Gemini variant that meets quality bar). No UX change.

**Measured outcome**: 57.3% cost reduction on our internal benchmark.
Cepien-specific estimate: 30-50% because their workload has more
deterministic steps (tagging, impact math) than our baseline.

## Direction B: Cepien consumes ClawPipe MCP (outbound)

**Change in Cepien**: add our MCP server to Aether's tool list.

```json
// cepien/aether/mcp-config.json
{
  "mcpServers": {
    "clawpipe": {
      "command": "npx",
      "args": ["-y", "clawpipe-mcp-server"],
      "env": { "CLAWPIPE_API_KEY": "cp_..." }
    }
  }
}
```

Then Aether can call:

- `clawpipe_analyze_cost(prompt)` — should this prompt go to Gemini Pro
  or Flash?
- `clawpipe_stats()` — current session cost/latency/cache-hit summary
- `clawpipe_booster_check(prompt)` — can this be resolved without any LLM?
- `clawpipe_report_to_jira` (**NEW**, to ship) — auto-file a ticket when
  budget cap breached
- `clawpipe_report_to_notion` (**NEW**, to ship) — write the weekly cost
  digest to a Notion DB

## New MCP tools to ship

### `clawpipe_report_to_jira`
Input: `{ summary, description, project_key, issue_type, severity }`
Action: creates Jira issue via REST API. Requires `JIRA_BASE_URL` +
`JIRA_EMAIL` + `JIRA_TOKEN` env vars on the MCP server.

### `clawpipe_report_to_notion`
Input: `{ database_id, title, body_markdown, properties }`
Action: creates a Notion page in the given database. Requires
`NOTION_TOKEN` env var.

These slot into `mcp-server/src/tool-jira.ts` and `tool-notion.ts`.

## Joint asset (co-marketing)

**Headline**: "Cepien ships features 120× faster. ClawPipe makes every AI
call in that loop cheaper."

**Asset**: a single dashboard screenshot showing `Cost saved this week`
alongside `Tickets created in Jira`. Both products' logos side-by-side.

**Hosting**: `clawpipe.ai/with-cepien` + `cepien.ai/with-clawpipe`.

**Rev share**: 20% of first 12 months' ClawPipe fees for Cepien-referred
customers. Tracked via `?ref=cepien` on signup.

## Launch sequence

1. Ship `tool-jira.ts` + `tool-notion.ts` in `mcp-server/`. **(us)**
2. Bump `clawpipe-mcp-server` to 3.1.0, republish.
3. Pilot integration in a Cepien branch (1-2 engineer-days their side).
4. Joint blog post: 57% + 120× = "ship fast AND cheap".
5. Co-announce on LinkedIn + HN.
