# Influencer outreach — 5 cold DMs

Five drafts. All under 120 words. All open with something specific to that person, ask for one small thing, and offer real value first. **Replace the `[reference: ...]` placeholders with something they actually posted in the current week** — a stale reference is worse than no reference.

Send via Twitter/X DM unless noted otherwise. If their DMs are closed, reply to a recent tweet with "I'd love to send you something — would you open DMs for a moment, or is there a better channel?" — short, specific, no link.

---

## 1. Simon Willison — `@simonw`

Why him: publishes about LLM tooling almost daily. Runs the `llm` CLI, writes the gold-standard "TIL" blog. If anyone enjoys a deterministic-rules wedge against LLM cost, it's Simon. Audience overlaps perfectly with ClawPipe's ICP.

Channel: Twitter/X DM, or Mastodon (`@simon@simonwillison.net`) if X is closed. He's also responsive on his blog comments.

```
Hi Simon — your [reference: their recent X tweet/blog about a specific LLM
tool or pattern, e.g. "your post on prompt caching last week"] made me think
you'd have an opinion on what we shipped: ClawPipe is an AI gateway with a
pre-LLM stage that resolves prompts like math/dates/JSON/conversions locally,
no provider call. 246 deterministic rules. 30% hit rate on a public 400-prompt
benchmark.

Wondered if you'd be up for trying it on your llm CLI workflow as a backend
— happy to set up a permanent free Scale-tier account so you can poke at it.
SDK is MIT, full benchmark methodology open. Would value your honest read,
positive or negative. No expectations.
```

(118 words.)

---

## 2. Shawn Wang (swyx) — `@swyx`

Why him: founder of AI Engineer Foundation + ai.engineer. Curates the AI dev tools landscape. Writes long-form analyses of the AI infra stack. Likely to engage with a "this fits a gap in the stack" pitch.

Channel: Twitter/X DM. He also responds to thoughtful Latent Space podcast emails.

```
Hi swyx — [reference: their recent X tweet/blog or Latent Space episode on
AI infra, e.g. "your taxonomy of LLM gateways from last month"] is what got
me thinking we needed to ship.

I built ClawPipe — AI gateway category, but with a wedge nobody else has: a
deterministic Booster stage in the SDK that resolves common prompts (math,
dates, JSON formatting, 246 patterns) without calling any LLM. 57% cost cut
on a published benchmark. SDK MIT.

Would love your read on whether this slots into the AI Engineer landscape
or whether we're missing something obvious. Happy to send draft positioning
+ early Scale account in exchange for an honest 5-min reaction.
```

(120 words.)

---

## 3. Yohei Nakajima — `@yoheinakajima`

Why him: BabyAGI author, prolific in the autonomous-agents space. Builders building agents are exactly the buyers who feel LLM cost first. He retweets things that look genuinely useful for agent infra.

Channel: Twitter/X DM.

```
Hi Yohei — your [reference: their recent X tweet about an agent project or
cost frustration, e.g. "your post about token spend on multi-step agents"]
landed for me. We're shipping the same week.

ClawPipe = AI gateway with a "skip the LLM" stage. For agent workloads
specifically, the Booster catches a lot of the deterministic sub-steps
(intermediate JSON formatting, lookups, math) that don't need a model call.
30% Booster hit on our benchmark. Public SDK, MIT.

Would you try it on a BabyAGI-style loop? I can send a custom benchmark on
an agent workload of your choice + a permanent Scale account. Just want an
honest reaction whether the fit is real or not.
```

(119 words.)

---

## 4. ThePrimeagen — `@ThePrimeagen`

Why him: massive dev-influencer reach via Twitch + YouTube. Often demos new tools live, frequently with a "this is actually clever" angle for things that earn it. The Booster wedge is exactly the kind of "wait, that's smart" angle that plays on stream.

Channel: Twitter/X DM. He's harder to reach by DM; an alternate path is sending the launch link to one of his moderators or replying to one of his "looking for project demos" tweets when one appears.

```
Hi Prime — [reference: their recent stream demo or X tweet, e.g. "your reaction
to that Rust LLM client last week was great"] inspired the framing here.

We just shipped ClawPipe. The hook: it's an AI gateway, except a stage in the
SDK resolves prompts like "what's 2+2", "format this JSON", "convert 5km to
miles" with regex, locally, sub-millisecond, no LLM call. 30% of prompts in
our 400-prompt benchmark never reach a provider. SDK is MIT, fully open.

Would you be up for a 10-minute live demo on stream? I'll send a permanent
Scale account no matter what. The "skip the LLM" reveal usually gets a
visible reaction — figured it might be your kind of bit.
```

(120 words.)

---

## 5. Logan Kilpatrick — `@OfficialLoganK`

Why him: Google DevRel for Gemini. Vertex AI is one of the 21 providers ClawPipe supports (full RS256 JWT integration, not a half-baked one). Practical reason to engage: ClawPipe makes Gemini easier to adopt for teams who don't want to build the auth dance themselves.

Channel: Twitter/X DM. He's responsive and pro-developer-tooling.

```
Hi Logan — [reference: their recent X tweet or post, e.g. "your launch thread
on the new Gemini Flash variant last week"] is one of the reasons we made
sure Vertex was a first-class provider in our gateway.

ClawPipe is a multi-provider AI gateway with full Vertex support — RS256 JWT
auto-refresh from a service account JSON, not a half-baked passthrough.
Teams who want Gemini-via-Vertex but don't want to write the auth
themselves can adopt it through us.

Would you be open to (a) a co-authored post on "shipping Gemini in
production through a gateway" or (b) just a quick honest look at whether our
Vertex integration meets the bar? Free Scale account either way.
```

(120 words.)

---

## Sending notes

- **Stagger the sends.** Don't DM all five on the same day. One per day across the week before launch.
- **Track responses in a small spreadsheet.** Columns: name, sent date, replied (y/n), reply sentiment (positive/neutral/negative/none), follow-up needed (y/n).
- **Don't follow up more than once.** If someone doesn't reply to the first DM, send one polite follow-up after 5 days, then drop it. Two ignored DMs is a no.
- **Never ask for a tweet.** Ask for an honest reaction. If they like the product they'll share it without being asked. Asking degrades the trust.
- **The ask scales with the relationship.** First-touch DM = "would you try it." Second contact (if positive) = "would you write a TIL / mention it." Don't skip rungs.
- **No mass-templating.** The `[reference: ...]` placeholder is the most important field — fill it with something genuinely from this week. A stale or generic reference reads as "I don't actually follow you" and tanks the response rate.
