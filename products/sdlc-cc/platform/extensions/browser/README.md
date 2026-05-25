# Privacy Gateway — Browser Extension

Scrub PII and secrets out of prompts **before** they reach ChatGPT,
Claude, Gemini, or Microsoft Copilot.

> Part of the [sdlc-platform privacy gateway](../../README.md). License: AGPL-3.0-or-later.

## What it does

1. Listens for the submit key (Enter) in the supported chat UIs.
2. Sends the prompt to your configured gateway's `/v1/redact` endpoint.
3. If detections fire, shows a confirm dialog with the redacted version.
4. On confirm, replaces the textarea and submits as normal.

## Supported surfaces

| Surface | URL match | Content script |
|---|---|---|
| ChatGPT | `chat.openai.com`, `chatgpt.com` | `src/content/chatgpt.ts` |
| Claude | `claude.ai` | `src/content/claude.ts` |
| Gemini | `gemini.google.com` | `src/content/gemini.ts` |
| Copilot | `copilot.microsoft.com` | `src/content/copilot.ts` |

## Requirements

- A reachable Privacy Gateway with `POST /v1/redact` exposed
  (request: `{text, presets?, tenant?}`; response:
  `{redacted, detections[], blocked, block_reason?}`).
- For self-host: gateway listens on `http://localhost:8080` by default.
- DLP presets configured tenant-side (`pii_default`, `secrets`,
  `legal`, `finance`, `healthcare`).

> The `/v1/redact` endpoint is not yet wired in `services/gateway`
> — it must be added before this extension is functional. See
> `ROADMAP.md` Track A2.

## Build

```bash
cd extensions/browser
npm install
npm run build           # outputs ./dist/
npm run package         # outputs ./privacy-gateway.zip for store submission
```

Load `./dist` as an unpacked extension in
`chrome://extensions` (Developer mode) or
`about:debugging` (Firefox).

## Configure

Open the extension's Options page. Set:
- **Gateway URL** — e.g. `http://localhost:8080`
- **API Key** — Bearer token if your gateway requires auth
- **Tenant** — tenant id header (optional)
- **Mode** — `preview` (confirm) or `auto` (silent redact)
- **Presets** — which DLP presets to enable

## Privacy

The extension transmits prompt text **only** to the gateway URL you
configure. Nothing else. No telemetry, no analytics.

## Roadmap

- Stream-aware interception (block tokens after submit if user types in-flight)
- Per-site overrides (e.g., enable on `chatgpt.com` only)
- Diff-view UI instead of `window.confirm`
- Cross-browser store submissions (Chrome / Edge / Firefox / Safari)
