# Privacy Gateway — VS Code Extension

Scrub PII and secrets out of prompts **before** they reach Copilot,
Cursor, Cline, Continue, or any AI assistant.

> Part of the [sdlc-platform privacy gateway](../../../README.md). License: AGPL-3.0-or-later.

## Commands

| Command | Default key | What it does |
|---|---|---|
| `Privacy Gateway: Scrub selection` | `Cmd+Alt+R` / `Ctrl+Alt+R` | Replace the selected text with the redacted version. |
| `Privacy Gateway: Scrub clipboard` | — | Replace the clipboard contents with the redacted version. |
| `Privacy Gateway: Toggle enabled` | — | Master switch; mirrored in the status bar. |
| `Privacy Gateway: Open settings` | — | Jump to the extension's settings page. |

## Settings

| Setting | Default |
|---|---|
| `privacyGateway.gatewayUrl` | `http://localhost:8080` |
| `privacyGateway.apiKey` | `""` (blank for unauthenticated self-host) |
| `privacyGateway.tenant` | `""` |
| `privacyGateway.presets` | `["pii_default", "secrets"]` |
| `privacyGateway.mode` | `preview` (or `auto`) |
| `privacyGateway.enabled` | `true` |

## Requirements

- A reachable Privacy Gateway with `POST /v1/redact` exposed.
- Suggested presets: `pii_default`, `secrets`, `legal`, `finance`, `healthcare`.

## Build

```bash
cd extensions/ide/vscode
npm install
npm run build
npm run package    # produces a .vsix you can sideload
```

To run in development:

1. Open this folder in VS Code.
2. Press **F5** — a new Extension Development Host launches with the extension loaded.
3. Edit a file, select some text containing an email or secret, then press `Cmd+Alt+R`.

## Privacy

Selected text is transmitted **only** to the gateway URL you configure.
No telemetry. No analytics. No third-party calls.

## Roadmap

- Intercepting proxy for AI extensions (Cline / Continue) — turn pre-flight scrub into a transparent pipeline rather than a manual command.
- Cursor + JetBrains builds (separate marketplace listings).
- Quick-pick UI for picking which presets to apply per-scan.
