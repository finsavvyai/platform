# sdlc.cc — Firefox extension (MV3 / WebExtensions)

Firefox port of the Chrome MV3 extension. Same content + popup +
background scripts; the only meaningful differences are in
`manifest.json`:

| Field | Chrome MV3 | Firefox MV3 |
|---|---|---|
| `background` | `{ service_worker: ..., type: "module" }` | `{ scripts: ["background.js"] }` (non-persistent event page) |
| `options_page` | `"options.html"` | `options_ui: { page, open_in_tab: true }` |
| `browser_specific_settings.gecko` | n/a | required for AMO listing — extension ID + min Gecko version |

The `chrome.*` runtime APIs we use (`chrome.storage.sync`,
`chrome.runtime.sendMessage`, `chrome.runtime.onMessage`,
`chrome.runtime.openOptionsPage`) all have Firefox-compatible
implementations under the `chrome` namespace as of Firefox 109+.
No `webextension-polyfill` needed for our surface.

## Load temporarily (dev)

1. Firefox → `about:debugging`
2. **This Firefox** → **Load Temporary Add-on…**
3. Pick `manifest.json` from this directory
4. Click the toolbar icon → enter endpoint + `sk_sdlc_*` key
5. Open <https://claude.ai>, type a prompt with PII, press Cmd-Enter

Temporary add-ons unload on restart. For persistent install, sign
the package via the Firefox Add-ons developer portal (AMO).

## Sign + distribute (AMO)

```bash
# Bump version in manifest.json before each upload
npx web-ext lint
npx web-ext build --source-dir . --artifacts-dir ../dist-firefox
# → dist-firefox/scrub_sdlc_cc-0.1.0.zip

# Upload at https://addons.mozilla.org/developers/ to sign + list.
# Listed (public store): full review; Unlisted (self-distributed):
# faster review, must distribute the signed .xpi yourself.
```

## What's identical to the Chrome version

- `background.js` — runtime message handler + scrubText() RPC
- `content.js` — claude.ai / chatgpt.com prompt interception
- `popup.html` + `popup.js` — toolbar config UI
- `options.html` — full settings page
- `icons/` — same PNG placeholders

## Edge cases

- Firefox doesn't auto-open the options page on install reliably
  across the Gecko background-script lifecycle. Users hit the
  toolbar icon → popup → Save → Test instead.
- `host_permissions` declared on install in Chrome are
  request-on-use in Firefox. First scrub call may show a permission
  prompt; user grants once and it sticks.
- Background type "module" isn't supported by Gecko in Firefox MV3;
  we use the classic `scripts: ["background.js"]` form. background.js
  is already written in non-module style, so no code change needed.
