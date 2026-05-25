# PushCI — CI/CD Status for VS Code

Run CI pipelines locally and see results inline, without leaving your editor.

## Features

- **Status Bar**: Live pass/fail indicator updates as pipelines complete
- **Sidebar**: Browse recent runs, expand to see individual checks
- **Run Pipelines**: Trigger `pushci run` directly from the command palette
- **View Logs**: Open last run output in a side panel
- **File Watching**: Auto-refresh on `pushci.yml` or cache changes

## Requirements

- [PushCI CLI](https://github.com/finsavvyai/pushci) installed and on PATH
- A `pushci.yml` config in your workspace root

## Quick Start

1. Install the extension
2. Open a project that contains `pushci.yml`
3. The status bar shows current pipeline state
4. Open the PushCI sidebar to browse run history

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

The extension watches two files in your workspace:

- `pushci.yml` — pipeline configuration (changes trigger a refresh)
- `.pushci/cache.json` — run results written by the CLI

When the cache file updates, the status bar and sidebar reflect the
latest run result immediately.

## Sidebar

The PushCI activity bar panel lists up to 20 recent runs. Expand any
run to see its individual checks. Hover a check to see its output.

## Development

```bash
cd extensions/vscode
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## License

MIT
