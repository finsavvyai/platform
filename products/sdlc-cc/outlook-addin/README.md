# sdlc.cc — Outlook add-in

Office.js add-in that adds a **Sanitize for AI** ribbon button to
Outlook (web + Windows + macOS desktop). Clicking it opens a taskpane
that scrubs the current email body via the sdlc.cc gateway's
`/v1/dlp/scrub` endpoint — same backend as the web app and browser
extension.

## Sideload (development)

1. Host the static files. Local dev: `cd web && python3 -m http.server 5175 --bind 127.0.0.1`. Or push to a Cloudflare Pages project via `wrangler pages deploy ./web`.
2. Edit `manifest.xml`: replace every `https://addin.sdlc.cc/*` URL with your actual host (e.g. `http://localhost:5175/*` for dev, or your Pages URL).
3. In Outlook on the web: **Get Add-ins** (gear icon) → **My add-ins** → **Add a custom add-in** → **Add from file** → pick `manifest.xml`.
4. The "sdlc.cc" group with **Sanitize for AI** appears in the ribbon (both Read and Compose modes).

> **Localhost note**: Outlook on the web requires HTTPS for sideload in production tenants. Local HTTP works only in some dev environments. The Pages-hosted variant is the friction-free path.

## Operation

| Mode | What "Scrub body" does |
|---|---|
| **Compose** (writing a new email or reply) | Reads the current draft, calls `/v1/dlp/scrub`, **replaces the draft body** with the redacted version. Per-category counts shown in the taskpane. |
| **Read** (viewing a received email) | Reads the body, calls `/v1/dlp/scrub`, shows a preview. **Does not modify the message** (read mode is read-only). Use **Copy clean text** to put the sanitized copy on your clipboard. |

Settings (endpoint + `sk_sdlc_*` key) are stored via
`Office.context.roamingSettings` so they sync across the user's
devices automatically.

## Files

| File | Role |
|---|---|
| `manifest.xml` | Office add-in manifest (XML form; AppSource-required) |
| `web/taskpane.html` + `taskpane.js` | main UI shown when the ribbon button is clicked |
| `web/commands.html` + `commands.js` | function-command host (placeholder for future direct-action ribbon buttons) |
| `web/icons/icon-{16,32,64,80,128}.png` | ribbon + taskpane icons (placeholder PNGs; replace before AppSource submit) |
| `web/_headers` | Cloudflare Pages headers — CSP carved for Office origins |

## Deploy

```bash
# Option 1: same Cloudflare account already used for scrub.sdlc.cc
wrangler pages project create sdlc-cc-outlook --production-branch main
wrangler pages deploy ./web --project-name=sdlc-cc-outlook --branch=main

# Custom domain: sdlc-cc/outlook-addin/web → addin.sdlc.cc
# (set CNAME in Cloudflare, then add custom domain in Pages settings)

# Option 2: any HTTPS host. Just point the manifest URLs at it.
```

## AppSource submission (later)

- Mint a real `<Id>` GUID (currently a placeholder)
- Replace placeholder icons with branded 16/32/64/80/128 PNGs
- Microsoft Partner Center → Marketplace offers → New Office add-in
- Validation tools: `npx office-addin-manifest validate manifest.xml`
- Test matrix: Outlook web (Chromium), desktop Windows, desktop Mac, mobile iOS/Android

## Security shape

- The add-in iframe is sandboxed by Office; CSP `frame-ancestors`
  restricts to legitimate Outlook origins (see `web/_headers`).
- The `sk_sdlc_*` key is stored in `roamingSettings` (server-side per
  user, not in browser localStorage). Office encrypts it in transit
  to Exchange.
- The add-in NEVER reads contacts, attachments, or rules — only
  the active item's body. Manifest declares `ReadWriteItem` (the
  minimum scope Outlook supports for "edit current message").
- All network egress is to your `/v1/dlp/scrub` endpoint. CSP
  `connect-src` whitelist enforces this.

## Roadmap

- Real branded icons + listing screenshots
- "Scrub and send" direct-action button (no taskpane open)
- Excel + Word add-ins (~50% file reuse)
- Unified manifest for M365 (when GA)
