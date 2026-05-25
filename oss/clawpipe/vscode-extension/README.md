# ClawPipe VS Code Extension

ClawPipe AI pipeline integration for Visual Studio Code.

## Features

- **Status Bar** — shows session cost in real-time: `ClawPipe: $0.42`
- **Analyze Prompt Cost** — select text, estimate token count and cost per model
- **Check Booster** — select text, check if Booster can resolve it without AI
- **Show Stats** — webview panel with full session telemetry

## Commands

| Command | Description |
|---------|-------------|
| `ClawPipe: Analyze Prompt Cost` | Estimate cost of selected text |
| `ClawPipe: Check Booster` | Check if selected text is boostable |
| `ClawPipe: Show Stats` | Open telemetry dashboard |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `clawpipe.apiKey` | `""` | Your ClawPipe API key |
| `clawpipe.projectId` | `"vscode-default"` | Project ID for telemetry |

## Development

```bash
npm install
npm run build
npm run package  # creates .vsix file
```

## License

MIT
