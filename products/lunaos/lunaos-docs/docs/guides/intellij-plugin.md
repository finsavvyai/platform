# IntelliJ Plugin

Install the LunaOS plugin for IntelliJ IDEA (and all JetBrains IDEs) to manage AI agent workflows directly from your editor.

**Compatibility:** IntelliJ 2024.1 through 2026.1+ (any JetBrains IDE)

## Installation

### From JetBrains Marketplace

1. Open **Settings** → **Plugins** → **Marketplace**
2. Search for `LunaOS`
3. Click **Install** and restart the IDE

### From Source

```bash
git clone https://github.com/lunaos-ai/lunaos-intellij.git
cd lunaos-intellij
./gradlew buildPlugin
```

The built plugin ZIP is at `build/distributions/LunaOS-1.0.0.zip`.

To install: **Settings** → **Plugins** → gear icon → **Install Plugin from Disk** → select the ZIP.

## Configuration

1. Go to **Settings** → **Tools** → **LunaOS**
2. Set **Endpoint** to `https://api.lunaos.ai` (or your self-hosted URL)
3. Paste your **API Key** — generate one at [agents.lunaos.ai/dashboard/api-keys](https://agents.lunaos.ai/dashboard/api-keys)
4. Click **Test Connection** to verify
5. Optionally set a **Default Agent ID** for editor context menu actions

### Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| Endpoint | `https://api.lunaos.ai` | LunaOS Engine API base URL |
| API Key | — | Your authentication key |
| Default Agent ID | — | Agent used by editor context actions |
| Auto-refresh | On | Periodically refresh agent list and run status |
| Refresh interval | 30s | How often to auto-refresh (5–300 seconds) |
| Notifications | On | Show balloon alerts for completed runs |

## Features

### Tool Window

The LunaOS tool window appears on the right sidebar with 3 tabs:

**Agents tab**
- Searchable list of all available agents
- Shows name, category, and description
- **Run Selected** — execute with no context
- **Run with Context** — provide input text before executing

**Runs tab**
- Sortable table of recent workflow executions
- Columns: Run ID, Agent, Status, Started, Duration
- **View Logs** — jump to the Logs tab for the selected run

**Logs tab**
- Enter a Run ID to load execution logs
- Displays timestamped log entries with level indicators
- Monospace font for readability

### Tools Menu

**Tools** → **LunaOS** contains:

| Action | Shortcut | Description |
|--------|----------|-------------|
| Run Agent... | `Ctrl+Alt+L` | Opens agent picker popup, then executes |
| Browse Agents | — | Opens Agents tab in tool window |
| View Recent Runs | — | Opens Runs tab in tool window |

### Editor Context Menu

1. Select any code in the editor
2. Right-click → **Analyze with LunaOS Agent**
3. The selected code is sent to your default agent for analysis
4. Results appear as a balloon notification

::: tip
Set a **Default Agent ID** in Settings → Tools → LunaOS for this to work. Use an agent that handles code analysis (e.g., `code-review`, `security-review`).
:::

### Status Bar Widget

The bottom-right status bar shows:
- **LunaOS: idle** — no active runs
- **LunaOS: 3 running** — active execution count

Click the widget to open the LunaOS tool window.

### Notifications

Balloon notifications appear for:
- Run started / completed
- Errors (API connection, agent failures)

Each notification includes action buttons:
- **View Logs** — opens the LunaOS tool window
- **Open Settings** — jumps to plugin configuration

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+L` | Open agent picker and run |
| Right-click selection → Analyze | Send code to default agent |

You can customize shortcuts in **Settings** → **Keymap** → search "LunaOS".

## Architecture

The plugin connects to your LunaOS Engine API over HTTPS:

```
IntelliJ Plugin → HTTPS → api.lunaos.ai
                           ├── GET  /api/agents
                           ├── POST /api/runs
                           ├── GET  /api/runs?limit=20
                           ├── GET  /api/runs/:id/logs
                           └── POST /api/analyze
```

All API calls use Bearer token authentication with your configured API key.

## Troubleshooting

### "Connection failed" on Test Connection

- Verify the endpoint URL includes `https://`
- Check your API key is valid and not expired
- Ensure your firewall allows outbound HTTPS to `api.lunaos.ai`

### No agents in the list

- Click **Refresh** in the Agents tab
- Verify your API key has the `agents:read` scope
- Check the engine API is running: `curl https://api.lunaos.ai/health`

### "Set a default agent" warning on Analyze

- Go to **Settings** → **Tools** → **LunaOS**
- Enter a valid agent ID in the **Default Agent ID** field

### Plugin not showing in sidebar

- Ensure you restarted the IDE after installation
- Check **View** → **Tool Windows** → **LunaOS** is enabled

## Source Code

The plugin is open source: [github.com/lunaos-ai/lunaos-intellij](https://github.com/lunaos-ai/lunaos-intellij)

Built with:
- Kotlin + IntelliJ Platform Gradle Plugin 2.x
- OkHttp for API calls
- Kotlin UI DSL v2 for all panels
- JDK 17 target
