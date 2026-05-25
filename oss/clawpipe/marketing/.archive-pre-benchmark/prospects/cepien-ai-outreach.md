# Cepien AI — outreach package (final)

Send sequence designed for Ioana Teleanu (founder, ex-Miro, ex-UiPath).

## Day 0 — LinkedIn DM

Subject line N/A (DM).

> Hi Ioana — congrats on Cepien. The Miro discipline shows in how the
> product story holds together.
>
> Quick angle: at 120× user acceleration, the Gemini 2.0 cost curve
> compounds fast. We measured 57% reduction on our own agent workloads
> on a public 400-prompt benchmark using the open Booster + Cache +
> Router stack.
>
> Not pitching. Just flagging — happy to send the reproducible
> benchmark dir + a one-line integration example if useful.
>
> — Shahar · ClawPipe (MIT, open-source)

## Day 3 — if no reply, soft follow-up

> Following up — also realized your Aether agent could use ClawPipe's
> MCP server directly (tools: cost analysis, booster check, weekly
> spend digest to Notion). 6 AI security skills also bundled now if
> any of your customers ask for that.
>
> Either way, here's the benchmark dir:
> github.com/finsavvyai/clawpipe/tree/main/benchmarks
>
> — Shahar

## Day 7 — if reply or warm

Subject: `Cepien × ClawPipe — 30-min look at the Gemini cost line`

> Hi Ioana,
>
> Thanks for the back-and-forth. Quick agenda for a 30-min call:
>
> 1. Walk through Cepien's current Gemini cost shape (you don't need to
>    share absolute numbers, ratios are enough).
> 2. Show what Booster catches on a sample of your real prompts (we can
>    do this offline from a redacted CSV — no live access needed).
> 3. One-line SDK integration vs full MCP integration — pros/cons.
> 4. Co-marketing angle if numbers make sense.
>
> Anchor times this week (Pacific / your TZ confirm):
> - Tue 9:00 / 18:00
> - Wed 9:00 / 18:00
> - Thu 9:00 / 18:00
>
> Calendly: <link>
>
> — Shahar
> ClawPipe · MIT open source · clawpipe.ai

## Talking points (call cheat sheet)

**If asked "how does this compare to Portkey/Helicone/LiteLLM?":**
- Booster (skip LLM entirely on 246 rule classes) — none of them have it
- Self-learning router — they're config-based
- Cross-provider tool unifier — none of them have it
- 57% measured benchmark, public + reproducible
- See clawpipe.ai/vs/portkey, /vs/litellm, /vs/cloudflare

**If asked "isn't Cloudflare AI Gateway free?":**
- CF AI Gateway is a logging proxy. ClawPipe is a pipeline.
- Same runtime (CF Workers). Adds Booster + Packer + Semantic Cache +
  Self-learning Router + Swarm + 15 default Guards on top.
- Detail at clawpipe.ai/vs/cloudflare.

**If asked about commitment:**
- npm install. Test with a single endpoint. Roll back by removing
  the import.
- No data leaves your environment beyond the provider call (Cloudflare
  Workers gateway is open source).
- MIT license — fork anytime.

**If asked about pricing:**
- Free tier 1K/day. Pro $49/mo for 100K/day. Half of Portkey Pro.
- Bundles available with sdlc.cc (compliance) and OpenSyber (security
  agents) under one invoice via accounts.openclaw.ai.

## Asks (from us)

1. 30-min intro with whoever owns Cepien's infra cost.
2. Permission to list Cepien on `clawpipe.ai/customers` after a measured
   savings figure exists.
3. Mutual intro to one investor in their network if the integration ships.

## Status

- [ ] LinkedIn DM sent (Day 0)
- [ ] Soft follow-up (Day 3)
- [ ] Email follow-up (Day 7+)
- [ ] Intro call booked
- [ ] Sample CSV benchmark sent
- [ ] Integration shipped in a Cepien feature branch
- [ ] customers/ listing live
- [ ] Co-marketing post published

## Templates ready
- Pre-filled LinkedIn DM above
- Email follow-up above
- Benchmark deck: `marketing/prospects/cepien-deck.md` (TODO if needed)
- Integration spec: `marketing/integrations/cepien-ai.md`
