# sdlc-cc-cf-gw — Cloudflare AI Gateway DLP plugin

Cloudflare Worker that sits in front of **Cloudflare AI Gateway**
and scrubs every LLM request body through sdlc.cc's `/v1/dlp/scrub`
before the gateway proxies it to Anthropic / OpenAI / etc.

## Why

Cloudflare AI Gateway is the de-facto cache + observability layer
for LLM traffic on Cloudflare. It doesn't ship a DLP step. If your
team already routes through `gateway.ai.cloudflare.com/v1/<acct>/<gw>/...`,
you can adopt sdlc.cc DLP **without changing any application code**
— just swap the gateway URL in your app for this Worker's URL.

## How

```
Your app
   │  POST /v1/<acct>/<gw>/anthropic/v1/messages
   │  body: { messages: [{ role:"user", content:"PAN 4111-..." }] }
   ▼
sdlc-cc-cf-gw  (this Worker)
   │  scrub user fields via /v1/dlp/scrub
   ▼
gateway.ai.cloudflare.com/v1/<acct>/<gw>/anthropic/v1/messages
   │  body: { messages: [{ role:"user", content:"PAN ************1111" }] }
   ▼
Anthropic
```

The Worker recognises both the Anthropic Messages shape and the
OpenAI Chat Completions shape — covering virtually every LLM client
in 2026.

## Deploy

```bash
cd cf-ai-gateway-worker
npm install
wrangler login
wrangler secret put SDLC_API_KEY           # paste your sk_sdlc_*
wrangler secret put CF_AI_GATEWAY_URL      # https://gateway.ai.cloudflare.com/v1/<acct>/<gw>
wrangler deploy
# → outputs https://sdlc-cc-cf-gw.<your-subdomain>.workers.dev
```

Then point your app at that URL instead of the AI Gateway URL. The
Worker forwards everything (paths, query, headers, auth) unchanged
except the JSON body, which gets DLP-scrubbed first.

## Scope

| Surface | Caught |
|---|---|
| Anthropic `messages[].content` (string or text blocks) | ✅ |
| Anthropic `system` prompt | ✅ |
| OpenAI `messages[].content` (string or text blocks) | ✅ |
| Streaming requests (`stream:true` / SSE Accept) | passed through unchanged (TODO: SSE scrub) |
| `tool_use` input arguments | passed through (TODO: recursive walk) |
| File / image uploads | passed through (binary; not scrubbable as text) |
| GET / non-POST | passed through unchanged |

## Fail-open

If `/v1/dlp/scrub` returns non-200, the Worker **passes the original
text through** rather than blocking the request. Reasoning: a scrub-
API outage would otherwise brick every customer call. The audit
dashboard will show 0 redactions during the outage window, which is
the correct signal that the gateway is bypassed.

Switch to fail-closed (return 503 on scrub error) by changing the
catch branch in `src/index.ts` `callScrub()`.

## Files

| File | Role |
|---|---|
| `src/index.ts` | Worker entry point — scrub + forward |
| `wrangler.toml` | binding config + non-secret vars |
| `package.json` | build deps (wrangler + workers-types) |
| `tsconfig.json` | strict TS |

## Roadmap

- SSE body scrubbing (buffer-then-emit shape from sdlc.cc proper)
- Recursive `tool_use` argument walking
- Configurable per-route fail-open vs fail-closed
- Built-in caching of scrub results for identical prompts
