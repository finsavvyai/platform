# sdlc.cc browser extension (MV3)

Intercepts prompt submission on **claude.ai** and **chatgpt.com**,
scrubs the text via your sdlc.cc gateway's `/v1/dlp/scrub` endpoint,
and replaces the input with the scrubbed version before letting the
host page send it to the LLM.

## Sideload (development)

1. Visit `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** → pick this `extension/` directory
4. Click the extension icon → enter your gateway endpoint (e.g.
   `http://localhost:8080` for local dev or `https://api.sdlc.cc`
   for prod) and your `sk_sdlc_*` key. Hit **Test** — you should
   see "✓ ok — N redactions in test payload".
5. Open <https://claude.ai>, type a prompt with PII (e.g. an SSN or
   credit card), press Cmd/Ctrl-Enter to send.

The extension intercepts, runs the scrub, replaces your input with
the redacted text, and shows a small badge in the bottom-right with
the redaction count. Press send again to actually submit.

## Two-step send by design

We never auto-submit a scrubbed prompt without showing the user.
Reasons:
- Aggressive redaction can change meaning (e.g. masking a country
  name by accident); user should review before sending.
- Compliance reviewers prefer "user explicitly approved redaction"
  over "redaction happened invisibly".

A clean prompt (no redactions) submits straight through with only
a brief "✓ clean — sending unchanged" toast.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 config, host permissions, content-script matches |
| `background.js` | service worker; only place fetch() to gateway lives |
| `content.js` | runs in claude.ai / chatgpt.com page; finds prompt input + intercepts send |
| `popup.html` + `popup.js` | toolbar popup for endpoint + key entry |
| `options.html` | full settings page (uses popup.js for behaviour) |
| `icons/` | placeholder 1×1 PNGs; replace before Chrome Web Store submit |

## Roadmap

- Real icons (16/32/48/128 + store screenshots)
- Per-redaction inline highlighting on the host page (hover to see
  what was masked)
- Chrome Web Store enterprise force-install policy + group-policy
  template (admx)
- Edge Add-ons listing (same manifest, separate listing)
- Firefox MV3 port (~1 week — most things compatible, fetch is the
  same; some host_permissions semantics differ)
- Add gemini.google.com / poe.com / perplexity.ai to host matches
