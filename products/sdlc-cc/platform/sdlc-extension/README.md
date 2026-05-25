# SDLC Guard — Browser extension for AI chat PII redaction

Manifest V3 extension for Chrome and Edge. Intercepts message-send across **ChatGPT (chatgpt.com)**, **Claude (claude.ai)**, **Gemini (gemini.google.com)**, and **Copilot (copilot.microsoft.com)** — runs a local PII scan before the keystroke completes, redacts in place, and posts an audit event to your SDLC tenant.

All scanning is **local** — no message bytes leave the browser unless they're already destined for the AI provider you typed them into. The audit event sent to `api.sdlc.cc` carries only entity counts and a hostname, never the redacted values.

## What gets caught

- Email addresses
- US Social Security numbers (with area-number sanity checks)
- Credit cards (Luhn-validated; 13–19 digits)
- US phone numbers (multiple formats)
- AWS access keys (AKIA / ASIA prefix)
- Generic API keys (`sk-`, `ghp_`, `xoxb-`, `github_pat_`, etc.)
- IPv4 addresses (octet-range validated)
- JWTs (`eyJ.eyJ.<sig>` triplet)

## Build & sideload

```bash
cd sdlc-extension
npm install
npm run typecheck
npm test
npm run build
```

In Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Configuration

After install, the options page opens automatically. Paste your SDLC API key from [sdlc.cc/dashboard](https://sdlc.cc/dashboard) and pick a policy:

- **Strict** — redact and show toast warning
- **Balanced** — redact silently (default)
- **Permissive** — audit only, no redaction (use for staging environments)

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest, host_permissions, content-script matches |
| `src/pii-scan.ts` | Pure regex-based scanner, Luhn-validated CC, IPv4 octet check |
| `src/content.ts` | Keydown interceptor, editor read/write across textarea / contenteditable / ProseMirror |
| `src/audit-client.ts` | Posts redaction events to `api.sdlc.cc/v1/audit` |
| `src/storage.ts` | `chrome.storage.sync` settings + `chrome.storage.local` daily counter |
| `src/popup/` | Toolbar popup — on/off toggle, today's block count |
| `src/options/` | Settings page — API key, endpoint, policy |
| `src/background.ts` | Service worker — opens options on install |

## Privacy

Read [PRIVACY.md](PRIVACY.md). TL;DR: the extension processes everything locally; nothing leaves your browser except the audit event you opt into by configuring an API key, and that event contains entity *counts*, not values.
