# sdlc.cc — Excel add-in

Office.js add-in for Excel (web + Windows + Mac desktop). Adds a
**Sanitize for AI** ribbon button under a "sdlc.cc" group on the
Home tab. Click it to open a taskpane that scrubs the active
selection via the same `/v1/dlp/scrub` endpoint as the web app,
browser extension, and Outlook add-in.

## Modes

| Mode | Effect |
|---|---|
| **Replace selection in place** | Overwrites the selected range with redacted values. Destructive — use Ctrl-Z to revert. |
| **Write to a new sheet (Sanitized)** | Default. Creates a new "Sanitized" worksheet (or "Sanitized 2", etc.) and writes the scrubbed copy there. Original untouched — the right choice for compliance workflows. |

Per-cell scrubbing: empty cells skip; non-empty cells go through the
gateway one at a time. Counts are aggregated across the whole
selection and shown in the taskpane.

## Sideload

1. Host the static files. Local: `cd web && python3 -m http.server 5176 --bind 127.0.0.1`. Or push to Cloudflare Pages: `wrangler pages deploy ./web --project-name=sdlc-cc-excel`.
2. Substitute the manifest URLs with your actual host (use the dev manifest helper below).
3. Excel → **Insert** → **My Add-ins** → **Upload My Add-in** → pick `manifest.xml`.
4. **Home** tab → **sdlc.cc** group → click **Sanitize for AI**.
5. In the taskpane: enter endpoint + `sk_sdlc_*` key → **Test** → select cells → **Scrub selection**.

## Dev manifest helper

```bash
# After deploying to Pages, build a sideload-ready manifest pointing
# at the live URL (skip if you've set up addin-excel.sdlc.cc).
sed 's|https://addin-excel\.sdlc\.cc|https://sdlc-cc-excel.pages.dev|g' \
  manifest.xml > manifest.dev.xml
```

`manifest.dev.xml` is gitignored so the production placeholder in
`manifest.xml` stays clean for AppSource later.

## Files

| File | Role |
|---|---|
| `manifest.xml` | TaskPaneApp manifest (production placeholders) |
| `web/taskpane.html` + `taskpane.js` | UI + Excel.run logic |
| `web/icons/` | placeholder PNGs |
| `web/_headers` | Pages CSP / frame-ancestors carved for Office origins |

## Excel.run quirks

- `Excel.run` opens a fresh request context per call — load() →
  sync() pattern is mandatory before reading any property.
- `range.values` returns a 2-D array `[[r0c0, r0c1], [r1c0, ...]]`.
  Numeric / boolean cells come through as their JS types; we coerce
  to string before scrubbing and write the scrubbed string back.
  This means scrubbing a number cell will convert it to text.
  Acceptable for the "PII in a numeric column" case (rare).
- Selection address (`B2:F50`) is stable; we display it in the
  taskpane so the user can verify before running.

## Roadmap

- Real branded icons + listing screenshots
- "Scrub on save" auto-mode (workbook-event-driven)
- Word add-in (~80% file reuse — different selection model)
- Excel custom function (`=SCRUB(A1)`) for inline use
- AppSource submission
