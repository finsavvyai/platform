# Prospect: Cepien AI

> "Ship products 120× faster and smarter." — B2B agent platform for
> product/design/research/CX teams. Built on Google Gemini 2.0.

## Why they fit ClawPipe

Cepien's core loop is expensive LLM-heavy work:

1. Ingest feedback/analytics/research/sales/support from many sources.
2. Gemini 2.0 classifies, clusters, scores impact.
3. Agent ("Aether") generates Jira tickets, Notion PRDs, Figma instructions,
   Cursor/Claude code.

Each user session = **5–20 LLM calls**. 120× user acceleration claim means
they are stress-tested to carry sustained volume. That is where our stack
flattens cost.

## Savings estimate (first-order)

| Line of cost | ClawPipe lever | Typical reduction |
|---|---|---|
| Feedback tagging / categorization | **Booster** resolves regex-solvable tags at $0 | 20-35% of that workload |
| Duplicate/near-duplicate feedback items | **Semantic cache** | 15-25% extra hit rate |
| Classification to Gemini Pro when Flash is enough | **Learning router** with task_type weighting | 20-40% on eligible calls |
| Impact scoring math (sum/avg/weight) | **Booster** stats rules | 100% on those calls |

On a $10K/mo Gemini bill: **~$3-5K/mo saved**. At the 120× scaling they
pitch, the absolute number grows linearly with users.

## Why we are NOT competitive

| Axis | Cepien | ClawPipe |
|---|---|---|
| Buyer | PMs, designers, researchers, CX | Developers, platform teams |
| Surface | Jira / Notion / Figma integration | SDK + gateway |
| Sold as | Finished insight product | Infrastructure layer |
| Provider stack | Gemini 2.0 | 20+ providers, their choice |

We sell pipes; they sell finished water. Perfect complement.

## Integration value (see `marketing/integrations/cepien-ai.md`)

- **Inbound**: Their `Aether` agent wraps its own provider calls via
  ClawPipe (one-line change). Saves them money while we gain usage proof.
- **Outbound**: ClawPipe MCP tools `clawpipe_report_to_jira`,
  `clawpipe_report_to_notion` land spend/budget anomalies directly in the
  same stack Cepien already owns.
- **Joint tagline candidate**: "Cepien ships features 120× faster.
  ClawPipe makes every AI call in that loop cheaper."

## Outreach

### Contact
- Founder: **Ioana Teleanu** (ex-Miro, ex-UiPath). Active on LinkedIn.
- Parent: Nsight Intelligence Corp. (rebranded 2025).
- Company page: https://www.linkedin.com/company/cepien-ai

### LinkedIn DM (paste-ready, ~90 words)

> Hi Ioana — congrats on the Cepien launch. The Miro discipline shows in
> how tight the product feels.
>
> Noticed the stack leans heavy on Gemini 2.0. At 120× user acceleration
> that is the cost curve our Booster + Cache + Router stack flattens.
> We measured 57% cost reduction on our own agent workloads on a public
> 400-prompt benchmark — reproducible from the repo.
>
> Not pitching today. Just flagging because the CFO math comes up faster
> than founders expect. Happy to send the benchmark dir + a no-code
> integration example if ever useful.
>
> — Shahar · ClawPipe (open-source)

### Email follow-up (if DM reply)

- Subject: `ClawPipe numbers for Cepien's Gemini line`
- Attach: `benchmarks/results/summary.md` + link to `/benchmarks`
- Offer: 30-min walk-through with their infra lead, no sales deck

### Asks
1. A 30-min intro with whoever owns infra cost.
2. Mutual intro to their favorite AI investor list (Cepien rebrand = fresh
   round recently, warm pool).
3. Permission to list Cepien on `/customers` after integration ships.

## Status tracker

- [ ] LinkedIn DM sent
- [ ] Email follow-up sent
- [ ] Intro call booked
- [ ] Integration implementation
- [ ] `customers` page listing
