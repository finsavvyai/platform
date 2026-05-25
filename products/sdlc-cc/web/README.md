# scrub.sdlc.cc — static web app

Single-page paste-and-redact UI. Calls the sdlc.cc gateway's
`/v1/dlp/scrub` endpoint with a user-supplied `sk_sdlc_*` key.

## Local preview

```bash
cd web && python3 -m http.server 5173
# open http://localhost:5173
```

By default points at `https://api.sdlc.cc`. To point at a local
gateway during dev, change the **API endpoint** field to
`http://localhost:8080` and re-save.

## Deploy to Cloudflare Pages

```bash
# one-time:
#   in Cloudflare → Pages → Create project → Connect to Git
#   pick the sdlc-cc repo
#   build command: (none — static)
#   build output directory: web
#   on deploy, project URL is e.g. sdlc-cc-web.pages.dev

# Add a custom domain (scrub.sdlc.cc):
#   Cloudflare DNS for sdlc.cc → CNAME scrub → sdlc-cc-web.pages.dev
#   then in Pages project → Custom domains → add scrub.sdlc.cc
```

CSP, X-Frame-Options, and Permissions-Policy headers ship via
`_headers`. Update `connect-src` if the gateway runs at a different
host than the defaults (`api.sdlc.cc` + `*.sdlc.cc`).

## What it does

- Persists endpoint + API key in `localStorage` (per-browser, not
  synced)
- POST to `/v1/dlp/scrub` with `Authorization: Bearer sk_sdlc_*`
- Renders the clean text and per-category redaction counts
- Cmd/Ctrl-Enter shortcut to scrub
- Clipboard paste / copy
- ~9KB total page weight, no framework, no build step

## What it deliberately does NOT do

- Save text anywhere on the client beyond the active session
- Send data to anywhere except the configured gateway
- Authenticate the user — anyone with a valid `sk_sdlc_*` can use it
  (the gateway is the access-control boundary)
