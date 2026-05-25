# LunaOS for Visual Studio Code

AI agent workflows in your editor -- run agents, write Luna pipes, view logs.

![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-8b5cf6)

## Features

### Luna Language Support
Syntax highlighting for `.luna` files with full support for the Luna pipe DSL -- keywords, operators, variables, comments, and strings.

### Sidebar Panel
Access agents, recent runs, and quick actions from the activity bar.

### Command Palette
- **Run Agent** -- pick an agent and execute it
- **Run Pipe Expression** -- enter an ad-hoc pipe like `req >> des >> plan >> go`
- **View Run Logs** -- stream logs to the output channel
- **Open Dashboard** -- jump to agents.lunaos.ai
- **Open Playground** -- embedded pipe editor with templates
- **Configure API Key** -- quick access to settings

### Status Bar
Shows active run count (`LunaOS: 2 running`) or idle state. Click to open the sidebar.

### Editor Context Menu
Right-click selected code and choose **Analyze with LunaOS Agent** to get AI-powered analysis.

### Playground Webview
Write and run Luna pipe expressions with template buttons and a live output panel. Dark theme matching VS Code.

## Getting Started

1. Install the extension from the VS Code Marketplace
2. Open Command Palette and run **LunaOS: Configure API Key**
3. Enter your API key from [agents.lunaos.ai](https://agents.lunaos.ai)
4. Start running agents and pipe expressions

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `lunaos.apiEndpoint` | `https://api.lunaos.ai` | API endpoint URL |
| `lunaos.apiKey` | *(empty)* | API key for authentication |
| `lunaos.defaultAgent` | *(empty)* | Default agent for context menu |
| `lunaos.autoRefresh` | `true` | Auto-refresh sidebar data |

## Luna Pipe DSL

```luna
# Full development pipeline
req >> des >> plan >> go >> test >> rev >> ship

# Conditional error handling
try { go >> test } catch { fix >> test }

# Parallel execution
parallel { perf, a11y, sec }

# Variables
$target = "auth-module"
debug $target >> fix >> test
```

## Screenshots

*Coming soon*

## License

MIT
