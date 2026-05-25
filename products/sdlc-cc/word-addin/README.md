# sdlc.cc — Word add-in

Office.js add-in for Word (web + Windows + Mac desktop). Adds a
**Sanitize for AI** ribbon button (Home tab → sdlc.cc group). Opens
a taskpane that scrubs the selection or whole document via the
gateway's `/v1/dlp/scrub` endpoint.

## Scope × mode matrix

|  | **Replace text in place** | **Insert sanitized copy below** |
|---|---|---|
| **Current selection** | overwrites highlighted text | appends scrubbed copy of selection to end of doc |
| **Entire document** | rewrites the whole body | appends a fully-scrubbed copy after a separator |

Use Replace for ad-hoc cleanup before copying to AI; use Insert-below
when the original must remain untouched (compliance workflow).

## Sideload

```bash
# Deploy if you haven't:
cd web && wrangler pages deploy . --project-name=sdlc-cc-word

# Build a sideload-ready manifest:
cd .. && sed 's|https://addin-word\.sdlc\.cc|https://sdlc-cc-word.pages.dev|g' \
  manifest.xml > manifest.dev.xml
```

Then Word → **Insert** → **My Add-ins** → **Upload My Add-in** → pick `manifest.dev.xml`.

## Files

| File | Role |
|---|---|
| `manifest.xml` | TaskPaneApp, host=Document, PrimaryCommandSurface on Home tab |
| `web/taskpane.html` + `taskpane.js` | UI + Word.run logic |
| `web/icons/` | placeholder PNGs |
| `web/_headers` | Pages CSP for Word iframe origins |

## Roadmap

- Real branded icons + AppSource submission
- Track changes mode (insert vs replace toggle from manifest)
- PowerPoint sibling (~80% reuse — slides instead of paragraphs)
