# LunaOS IntelliJ Plugin

Manage AI agent workflows directly from your JetBrains IDE.

[![JetBrains Plugin](https://img.shields.io/jetbrains/plugin/v/ai.lunaos.intellij?label=Marketplace)](https://plugins.jetbrains.com/plugin/ai.lunaos.intellij)
[![IntelliJ Compatibility](https://img.shields.io/badge/IntelliJ-2024.1%2B-blue)](https://www.jetbrains.com/idea/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Build](https://img.shields.io/github/actions/workflow/status/lunaos/lunaos-intellij/ci.yml?branch=main)](https://github.com/lunaos/lunaos-intellij/actions)

---

## Overview

LunaOS for IntelliJ brings AI agent orchestration into your development workflow. Browse available agents, trigger workflow runs, stream execution logs, and analyze selected code with AI -- all without leaving the IDE. The plugin connects to your LunaOS Engine API and provides real-time status updates through a dedicated tool window and status bar widget.

## Features

### Tool Window (3 Tabs)

The LunaOS tool window anchors to the right sidebar and contains three tabs:

- **Agents** -- Searchable agent list with category filtering. Select an agent and click "Run Selected" for immediate execution, or "Run with Context..." to provide input parameters.
- **Runs** -- Sortable table of recent workflow runs showing run ID, agent name, status, start time, and duration. Select a run and click "View Logs" to switch to the Logs tab.
- **Logs** -- Enter a run ID to fetch and display timestamped, level-tagged log entries in a monospace viewer. Supports clear and reload.

### Tools Menu Actions

Under **Tools > LunaOS**:

| Action | Description |
|--------|-------------|
| Run Agent... | Opens a popup to select and execute an agent |
| Browse Agents | Opens the tool window Agents tab |
| View Recent Runs | Opens the tool window Runs tab |

### Editor Context Menu

Right-click selected code to access **Analyze with LunaOS Agent**. Sends the selection to the configured default agent and displays the analysis result as a balloon notification. Requires a default agent ID in settings.

### Status Bar Widget

Displays current run count at the bottom of the IDE. Shows "LunaOS: idle" when no runs are active or "LunaOS: N running" during execution. Click the widget to open the LunaOS tool window.

### Settings Page

Accessible at **Settings > Tools > LunaOS**. Includes a "Test Connection" button to verify API connectivity before saving.

### Notification System

Balloon notifications for run completion, errors, and warnings. Completed run notifications include action buttons to "View Logs" and "Open Settings" for quick navigation.

## Installation

### From JetBrains Marketplace

1. Open **Settings > Plugins > Marketplace**
2. Search for "LunaOS"
3. Click **Install** and restart the IDE

### Build from Source

```bash
git clone https://github.com/lunaos/lunaos-intellij.git
cd lunaos-intellij
./gradlew buildPlugin
```

The plugin ZIP will be in `build/distributions/`. Install via **Settings > Plugins > Install Plugin from Disk**.

## Configuration

Open **Settings > Tools > LunaOS** and configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Endpoint | `https://api.lunaos.ai` | LunaOS Engine API base URL |
| API Key | *(empty)* | Bearer token for authentication. Generate at `agents.lunaos.ai/dashboard/api-keys` |
| Default Agent ID | *(empty)* | Agent used by the editor context menu action |
| Auto-refresh | `true` | Automatically refresh agent list and run status |
| Refresh interval | `30` seconds | Polling interval when auto-refresh is enabled (5--300s) |
| Notifications | `true` | Show balloon notifications for completed runs |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+L` | Run Agent... (select and execute) |

Shortcuts can be customized in **Settings > Keymap** under the "LunaOS" group.

## Requirements

- IntelliJ IDEA 2024.1 or later (Community or Ultimate), or any compatible JetBrains IDE
- JDK 17 or later
- A LunaOS API key (generate at [agents.lunaos.ai](https://agents.lunaos.ai))

## Development

### Prerequisites

- JDK 17+
- Gradle 8.11+ (wrapper included)

### Build and Run

```bash
# Clone the repository
git clone https://github.com/lunaos/lunaos-intellij.git
cd lunaos-intellij

# Run in a sandbox IDE instance
./gradlew runIde

# Build the plugin distribution
./gradlew buildPlugin

# Verify compatibility across IDE versions
./gradlew verifyPlugin
```

### Running Tests

```bash
./gradlew test
```

## Architecture

```
src/main/kotlin/ai/lunaos/intellij/
  actions/              # IDE actions (RunAgent, ListAgents, ViewRuns, AnalyzeWithAgent)
  notifications/        # Balloon notification helper (LunaNotifier)
  services/             # API client (OkHttp + Gson) and run state tracking
  settings/             # Persistent settings state and configurable UI panel
  statusbar/            # Status bar widget factory and widget implementation
  toolwindow/           # Tool window factory, AgentsPanel, RunsPanel, LogsPanel

src/main/resources/
  META-INF/plugin.xml   # Plugin descriptor (extensions, actions, shortcuts)
  icons/                # Plugin icons (SVG)
```

Key dependencies: OkHttp 4.12 for HTTP, Gson 2.11 for JSON, IntelliJ Platform SDK 2024.1.

## License

MIT
