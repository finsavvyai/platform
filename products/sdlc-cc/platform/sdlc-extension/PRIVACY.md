# SDLC Guard — Privacy Policy

**Effective**: 2026-04-20

## Data we process

The extension reads the contents of message editors on the supported chat surfaces (chatgpt.com, claude.ai, gemini.google.com, copilot.microsoft.com) **only when the user presses Enter to send a message**. The text is processed entirely inside the user's browser by a local regex-based scanner.

## Data we transmit

If — and only if — the user has configured an SDLC API key on the Options page, the extension POSTs an audit event to the configured `endpoint` (default `https://api.sdlc.cc`). The event contains:

- the source hostname (e.g., `chatgpt.com`)
- the page URL
- a histogram of detected entity types (e.g., `{"EMAIL": 1, "SSN": 1}`)
- a UTC timestamp

The event **never** contains the redacted values themselves, the surrounding message text, or any user identifier other than what the SDLC API key already identifies.

## Data we store on-device

- `chrome.storage.sync`: API key, endpoint URL, policy choice. Synced across the user's Chrome profile.
- `chrome.storage.local`: a per-day count of how many PII matches were redacted. Reset every UTC midnight.

## Permissions

- `storage` — required for the settings + counter above.
- `activeTab` — used by the popup to inspect the current tab's hostname for the source label.
- `host_permissions` (the four chat surfaces and `api.sdlc.cc`) — required for the content script to attach and the audit POST to succeed.

We do not request `tabs`, `cookies`, `webRequest`, or any other broad-surface permission.

## Source code

The extension is open source at [github.com/finsavvyai/sdlc-platform/tree/main/sdlc-extension](https://github.com/finsavvyai/sdlc-platform/tree/main/sdlc-extension). Audit it before you trust it.

## Contact

Questions: privacy@sdlc.cc.
