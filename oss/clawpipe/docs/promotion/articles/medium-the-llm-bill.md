---
title: "The LLM bill that wouldn't go down"
subtitle: "Why we built a pipeline that skips the model entirely on a third of our prompts"
canonical_url: https://clawpipe.ai/blog/the-llm-bill
publication: medium
tags: [LLM, AI, Cost Optimization, OpenAI, Engineering]
---

# The LLM bill that wouldn't go down

Eight months into running a small AI app at modest scale, I noticed
something I should have noticed sooner: the OpenAI invoice wasn't
getting cheaper. The product was getting smarter. The infrastructure
was getting more efficient. The team was getting faster. The bill kept
climbing.

I went prompt by prompt through a week of production logs and the
shape of the problem clarified. Maybe a third of our requests didn't
need a language model at all.

A user types `convert 5km to miles`. It runs through a context
template, a few hundred system tokens get added, the whole thing
flies to OpenAI, GPT-4o-mini does what a calculator could have done
in nanoseconds, the response comes back, we parse it, we render it.
We pay for it.

Another asks `give me a UUID`. Same path. We could have called
`crypto.randomUUID()` for free.

`format this JSON {"foo": 1, "bar": 2}` — `JSON.stringify(parsed,
null, 2)` is the right answer. We were billing tokens for it.

`what's today's date in ISO format` — `new Date().toISOString()`.

`decode this JWT eyJhbGciOi...` — `JSON.parse(atob(parts[1]))`.

I went through about 200 of these in an afternoon and started
keeping a tally. Math problems with operators. Format conversions.
Code snippet evaluations that any small library handles. Color
conversions. Date arithmetic. ISO country and currency lookups.
JWT decoding. Regex tests. Markdown to HTML. CSV to JSON. The list
got long.

These are *deterministic* prompts. There's a single correct answer.
A language model can produce that answer, but the language model is
the wrong tool. It's a hammer where a screwdriver would have been
faster, cheaper, and more reliable. (Models occasionally hallucinate
on math under load. I have screenshots.)

So I started writing rules.

## Booster

The pattern is dumb on purpose. Each rule is a `(test, resolve)`
function pair. `test(input: string)` returns true if the rule
applies. `resolve(input: string)` returns the answer.

```ts
const greaterThan: BoosterRule = {
  name: 'math_gt',
  test: (i) => /^is\s+\d+\s*>\s*\d+\??$/i.test(i),
  resolve: (i) => {
    const [a, b] = i.match(/\d+/g)!.map(Number);
    return a > b ? 'true' : 'false';
  },
};
```

That's the whole shape. Drop a rule into a registry, and the
pipeline tries each one in order on every incoming prompt. First
match wins. If nothing matches, we fall through to the LLM.

Two hundred and forty-six rules later, I had a stage I started
calling Booster. Twenty-four packs grouped by topic — math, regex,
format, color, dev (JWT/URL/MIME/HTTP/semver), time, science,
logic, crypto (SHA/MD5/GUID), ISO countries/currencies/languages,
AWS regions/colos, markup conversions, geometry, physics,
chemistry, music, finance.

On a synthetic 400-prompt benchmark with mixed difficulties (200
unique × 2 passes), Booster catches **30%** of prompts. Sub-millisecond
each. Zero tokens. Zero provider call. The cost line on those
requests is exactly zero.

## What about the other 70%?

Booster only does deterministic. The hard prompts still go to a
model. I wrote a four-stage pipeline around Booster to squeeze
those:

**Pack** compresses context windows. Most prompts have system
boilerplate — instructions, examples, formatting reminders. Pack
deduplicates and trims. Average token saving in the benchmark is
4.36 per prompt; on packable categories it's 10.18.

**Cache** does semantic deduplication. Two prompts that mean the
same thing in different words shouldn't pay twice. Hash + Cloudflare
Workers AI BGE-small embedding similarity. After two passes, the
benchmark hits a 35% cache hit rate.

**Route** picks a model. Most "AI gateways" let you write a fallback
chain — try OpenAI, fall back to Anthropic, fall back to Groq. That
works for liveness; it doesn't lower cost. I wanted a router that
*learns*. After every successful call, a per-model `score` updates
from observed cost, latency, and (optionally) quality. Cheap and
fast models drift to the top of the ranking on simple tasks; the
expensive ones get reserved for genuinely complex prompts. It's not
a full bandit — no Thompson sampling, no UCB — just a normalized
moving average. It still beats "always pick the cheapest" by ~12
points on our benchmark.

**Call** dispatches to the chosen provider. Twenty-one of them. The
SigV4 signing for Bedrock is its own little side quest; Vertex AI's
RS256 JWT is another. The plumbing is boring. The fact that the
router can pick across all of them is the point.

**Learn** writes the outcome back, updates weights, optionally syncs
to a global gateway so other instances learn faster.

End-to-end: **57.3% cost reduction** on the 400-prompt benchmark,
0.022ms pipeline overhead. The methodology is in
`benchmarks/results/summary.md` in the repo. Real arithmetic against
published per-token prices, not measured production traffic. Your
mileage on your prompt mix will differ.

## What this is not

It's not magic. It's a routing layer with a deterministic
pre-filter. The Booster wedge only works on the slice of your
traffic that *is* deterministic. For most apps that slice is more
than zero. For a customer-support chatbot answering free-form
questions about a product, it's probably small. For a developer
tool with parsers and formatters and conversions inside it, it's
huge.

It's also not a replacement for prompt engineering. If your prompts
are sloppy, the cache hit rate is low because near-duplicates don't
collapse. If your context is 6000 tokens of boilerplate, Pack helps
but only marginally — the better fix is to trim the boilerplate.
Booster, Pack, and Cache are *infrastructure*. They make a good
prompt cheaper. They don't fix a bad one.

## The thing that surprised me

The most surprising win wasn't Booster. It was **how often Booster
caught prompts I would have sworn needed an LLM**. Customer-support
prompts that ended up containing JSON snippets the model was being
asked to "summarize" — Booster's JSON formatter caught them. Product
analytics prompts that asked for date math — Booster's `time` pack
caught them. A whole class of "tell me what this color hex is in
RGB" requests inside a UI tool — `color` pack.

The closer I looked, the more I realized: a lot of "AI features" in
production apps are deterministic transformations dressed up in
natural language. The ChatGPT moment trained users to phrase things
conversationally. Behind the conversation is, sometimes, just
arithmetic.

## Try it

The SDK is MIT-licensed and on npm: `npm install clawpipe-ai`. The
hosted gateway has a free tier (1,000 calls/day, no card). The
pipeline runs in your process — no extra round trip, no
proxy-induced latency. You can see Booster's hit rate against your
own traffic from day one. The whole thing is open source if you
want to read it: github.com/finsavvyai/clawpipe-sdk.

If a third of your prompts are deterministic, Booster will find
them. If they're not, the cache and router still earn their keep.
And if neither helps? You'll have spent three minutes pasting an
import and you'll know exactly which fraction of your prompts
genuinely needed a language model. That's a useful number even if
ClawPipe isn't the right answer for you.

The bill went down. Not as much as I'd hoped — production traffic
is messier than a benchmark — but enough that I'm comfortable
saying *most* AI bills could be lower than they are. The tools to
shave them aren't novel; they just haven't been bundled together in
a single SDK before. So I bundled them.

That's the whole pitch. Thanks for reading.
