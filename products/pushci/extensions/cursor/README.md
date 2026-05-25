# PushCI — Cursor Plugin

Run CI pipelines locally and see results inline — without leaving Cursor.

> Cursor is a VS Code fork, so the PushCI extension runs natively. This package
> is the same code as `extensions/vscode`, published to Open VSX (Cursor's
> default marketplace) and branded for Cursor.

## Install

### From Open VSX (Cursor default marketplace)

```
ext install finsavvyai.pushci-cursor
```

Or search "PushCI" in the Cursor Extensions panel.

### From VSIX (manual)

```bash
cd extensions/cursor
npm install
npm run compile
npm run package     # produces pushci-cursor-<version>.vsix
cursor --install-extension pushci-cursor-<version>.vsix
```

## Features

- **Status Bar** — Live pass/fail indicator updates as pipelines complete
- **Sidebar** — Browse recent runs, expand to see individual checks
- **Run Pipelines** — Trigger `pushci run` from the command palette
- **View Logs** — Open last run output in a side panel
- **File Watching** — Auto-refresh on `pushci.yml` or cache changes
- **Cursor-native** — Works with Cursor Chat: ask "why did this pipeline fail?"
  and Cursor AI reads the cache inline

## Requirements

- [PushCI CLI](https://pushci.dev/install) on `PATH`
- A `pushci.yml` config in your workspace root (or run `pushci init`)

## Commands

| Command | Description |
|---------|-------------|
| `PushCI: Run Pipeline` | Execute `pushci run` in a terminal |
| `PushCI: Show Status` | Refresh the sidebar and status bar |
| `PushCI: View Logs` | Open last run logs in a webview panel |
| `PushCI: Initialize Project` | Run `pushci init` to scaffold config |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `pushci.autoCheckOnSave` | `false` | Run pipeline on every file save |

## How It Works

Watches two files in your workspace:

- `pushci.yml` — pipeline configuration (changes trigger refresh)
- `.pushci/cache.json` — run results written by the CLI

When the cache file updates, status bar and sidebar reflect the
latest run result immediately. The same file is readable by Cursor
Chat, so AI context includes your CI state automatically.

## Shared Source

This extension compiles from `../vscode/src/` — the same TypeScript code
powers both the VS Code and Cursor builds. Bug fixes land in one place.

## Development

```bash
cd extensions/cursor
npm install
npm run compile
# Open this folder in Cursor, press F5 to launch Extension Development Host
```

## Publishing

```bash
npm run package             # build .vsix
npm run publish:ovsx        # publish to Open VSX (Cursor default)
npm run publish:marketplace # publish to VS Code Marketplace
```

Both registries accept the same VSIX.

## License

MIT
