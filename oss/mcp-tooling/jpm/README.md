<div align="center">

# NPM Plus

### AI-Powered JavaScript Package Management

[![npm version](https://img.shields.io/npm/v/npmplus-mcp-server.svg?color=cb0000&label=npm)](https://www.npmjs.com/package/npmplus-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/npmplus-mcp-server.svg?color=blue)](https://www.npmjs.com/package/npmplus-mcp-server)
[![GitHub stars](https://img.shields.io/github/stars/shacharsol/js-package-manager-mcp?style=social)](https://github.com/shacharsol/js-package-manager-mcp)
[![GitHub last commit](https://img.shields.io/github/last-commit/shacharsol/js-package-manager-mcp)](https://github.com/shacharsol/js-package-manager-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg)](https://api.npmplus.dev/mcp)

**The MCP server that gives your AI editor full control over npm, yarn, pnpm, and Bun.**
Search, install, audit, analyze, compare — all through natural language.

Works with **Claude** | **Windsurf** | **Cursor** | **VS Code** | any MCP-compatible editor

[Get Started](#quick-start) | [All Tools](#available-tools) | [Editor Setup](#editor-setup) | [Self-Host](docs/SELF_HOSTING.md)

</div>

---

<!-- TODO: Replace with actual demo GIF -->
<!-- <p align="center"><img src="docs/assets/demo.gif" width="700" alt="NPM Plus demo" /></p> -->

## Why NPM Plus?

| Without NPM Plus | With NPM Plus |
|---|---|
| Alt-tab to terminal, type commands, copy output back | *"Install express and cors as dependencies"* |
| Manually run `npm audit`, parse JSON output | *"Are there any security issues in my project?"* |
| Open bundlephobia.com, search, compare | *"Compare moment vs dayjs vs date-fns"* |
| Run `npm outdated`, update one by one | *"Update all outdated packages"* |
| Google "best React form library 2026" | *"Search for React form validation libraries"* |

**Your AI editor already writes code. NPM Plus lets it manage your packages too.**

## Quick Start

### Hosted Service (Recommended — zero setup)

Add to your editor's MCP config:

```json
{
  "mcpServers": {
    "npmplus-mcp": {
      "transport": "http",
      "url": "https://api.npmplus.dev/mcp"
    }
  }
}
```

### Via npx (Local)

```json
{
  "mcpServers": {
    "npmplus-mcp": {
      "command": "npx",
      "args": ["-y", "npmplus-mcp-server"]
    }
  }
}
```

That's it. Ask your AI editor to *"search for React testing libraries"* and it just works.

## Available Tools

17 tools covering the full package management lifecycle:

| Category | Tools | What you can say |
|----------|-------|------------------|
| **Discovery** | `search_packages`, `package_info`, `download_stats` | *"Find popular auth libraries"* |
| **Compare** | `compare_packages` | *"Compare express vs fastify vs hono"* |
| **Install** | `install_packages`, `update_packages`, `remove_packages` | *"Install lodash as a dev dependency"* |
| **Security** | `audit_dependencies`, `check_vulnerability` | *"Are there vulnerabilities in express 4.17?"* |
| **Analysis** | `check_bundle_size`, `dependency_tree`, `analyze_dependencies` | *"Show me circular dependencies"* |
| **Compliance** | `list_licenses`, `check_license` | *"List all non-MIT licenses in my project"* |
| **Maintenance** | `check_outdated`, `clean_cache`, `debug_version` | *"What packages are outdated?"* |

## Editor Setup

<details>
<summary><strong>Claude Desktop</strong></summary>

Config file: **macOS** `~/Library/Application Support/Claude/claude_desktop_config.json` | **Windows** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "npmplus-mcp": {
      "transport": "http",
      "url": "https://api.npmplus.dev/mcp"
    }
  }
}
```
</details>

<details>
<summary><strong>Windsurf</strong></summary>

**Hosted** — add to `mcp_config.json`:
```json
{
  "mcpServers": {
    "npmplus-mcp": {
      "serverUrl": "https://api.npmplus.dev/mcp"
    }
  }
}
```

**Local (npx):**
```json
{
  "mcp": {
    "servers": {
      "npmplus-mcp": {
        "command": "npx",
        "args": ["-y", "npmplus-mcp-server"],
        "disabled": false
      }
    }
  }
}
```

See [Windsurf Usage Guide](docs/CURSOR_WINDSURF_USAGE.md#-windsurf-usage)
</details>

<details>
<summary><strong>Cursor</strong></summary>

```json
{
  "mcpServers": {
    "npmplus-mcp": {
      "command": "npx",
      "args": ["-y", "npmplus-mcp-server"]
    }
  }
}
```

> **Note:** Use npx (stdio) transport for Cursor. HTTP transport is experimental.

See [Cursor Usage Guide](docs/CURSOR_WINDSURF_USAGE.md#-cursor-usage)
</details>

<details>
<summary><strong>VS Code / Cline</strong></summary>

**Option 1 — Cline extension:** In chat, type *"add a tool for JavaScript package management using npmplus-mcp-server"*

**Option 2 — Manual config** (`cline_mcp_settings.json` or `.vscode/mcp.json`):
```json
{
  "mcpServers": {
    "npmplus-mcp": {
      "command": "npx",
      "args": ["-y", "npmplus-mcp-server"]
    }
  }
}
```

See [VS Code + Cline Guide](docs/VSCODE_CLINE_SETUP.md)
</details>

## Architecture

Built with **TypeScript**, **MCP SDK**, **Zod**, **Execa**, **Pacote**, and **Node-cache**.

- **Auto-detection** of npm, yarn, pnpm, or Bun in your project
- **Intelligent caching** with configurable TTLs
- **Rate limiting** to prevent API throttling
- **Parallel operations** for batch processing
- **Optimized responses** for AI context windows

## Security

- Isolated subprocess execution via `execa`
- Input validation with Zod prevents injection attacks
- Uses only official vulnerability databases (GitHub Advisory, OSV)
- No credential storage or sensitive data handling
- CORS-enabled for secure web integration

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
git clone https://github.com/shacharsol/js-package-manager-mcp.git
cd js-package-manager-mcp
npm install && npm run build && npm test
```

## Documentation

- [Editor Setup Guide](docs/CURSOR_WINDSURF_USAGE.md) — Detailed per-editor instructions
- [Self-Hosting & Deployment](docs/SELF_HOSTING.md) — Run your own instance
- [API Reference](docs/API.md) — Full tool documentation
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Common issues & fixes
- [Changelog](CHANGELOG.md) — Version history

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Created by [Shachar Solomon](https://github.com/shacharsol)

If NPM Plus saves you time, **[give it a star](https://github.com/shacharsol/js-package-manager-mcp)**

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/shacharsol/js-package-manager-mcp)

</div>