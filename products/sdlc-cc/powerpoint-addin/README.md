# sdlc.cc — PowerPoint add-in

Office.js add-in for PowerPoint (web + Windows + Mac desktop). Adds
**Sanitize for AI** to Home tab → `sdlc.cc` group. Scrubs slide
text + speaker notes through `/v1/dlp/scrub`.

## Scope × notes matrix

|  | **Selected slide(s)** | **All slides** |
|---|---|---|
| **+ notes** | scrubs selected slides' shapes and their speaker notes | scrubs the whole deck — every shape + every note |
| **slide text only** | scrubs only the shapes on selected slides | scrubs every shape across all slides |

Selection covers the user's actual workflow ("clean up this one
slide before sharing"). All-slides + notes is the compliance-grade
"sanitize the whole deck" pass.

## Sideload

```bash
cd web && wrangler pages deploy . --project-name=sdlc-cc-ppt
cd .. && sed 's|https://addin-ppt\.sdlc\.cc|https://sdlc-cc-ppt.pages.dev|g' \
  manifest.xml > manifest.dev.xml
```

Then PowerPoint → **Insert** → **My Add-ins** → **Upload My Add-in** → pick `manifest.dev.xml`.

## Files

| File | Role |
|---|---|
| `manifest.xml` | TaskPaneApp, host=Presentation, PrimaryCommandSurface on Home tab |
| `web/taskpane.html` + `taskpane.js` | UI + PowerPoint.run logic |
| `web/icons/` | placeholder PNGs |
| `web/_headers` | Pages CSP for PowerPoint iframe origins |

## PowerPoint.run quirks

- The PowerPoint object model is shallower than Word/Excel — no
  rich `Excel.Range` equivalent. We iterate `slides[].shapes[]`
  and read each shape's `textFrame.textRange.text`.
- `notesSlide` exposes the speaker-notes page as a regular slide
  whose shapes contain the notes text. Same iteration shape.
- Setting `textRange.text` preserves formatting context — bullets,
  fonts, colors all survive. Direct `text` assignment via the
  taskpane has the same shape Microsoft uses internally.
- "Selected slides" uses `getSelectedSlides()` which respects
  multi-select in the slide pane (Ctrl-click), not the in-canvas
  shape selection.

## Roadmap

- Real branded icons + AppSource submission
- Per-shape-level reporting (which shapes had PII?) for forensics
- Pictures with embedded text — OCR via sdlc-core/dlp + image upload
  endpoint (future)
