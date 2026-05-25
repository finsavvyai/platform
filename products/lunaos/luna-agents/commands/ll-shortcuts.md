# luna-shortcuts - Quick Access to Luna Skills & Commands

## Command Overview

The `luna-shortcuts` command provides quick access to all Luna agents, commands, and skills with intelligent shortcuts and aliases. It acts as a central hub for discovering and executing Luna capabilities efficiently.

## Usage Instructions

### List All Shortcuts
```bash
luna-shortcuts
```
Shows all available shortcuts, commands, and agents with descriptions.

### Execute Shortcut
```bash
luna-shortcuts [shortcut-name]
```
Executes the specified shortcut or command directly.

### Search Shortcuts
```bash
luna-shortcuts search [keyword]
```
Searches for shortcuts matching the keyword.

### Create Custom Shortcut
```bash
luna-shortcuts create [name] [command]
```
Creates a custom shortcut for frequently used commands.

## Quick Access Shortcuts

### Design & UI Shortcuts
- **`hig`** → `luna-hig` - Apple HIG design analysis
- **`design`** → `luna-design-architect` - Design architecture
- **`ui-convert`** → `luna-ui-convert` - Convert UI to Apple HIG + Decart modern design
- **`ui-test`** → `luna-ui-test` - Run UI/UX tests with Playwright
- **`ui-fix`** → `luna-ui-fix` - Automated UI corrections and improvements

### Deployment Shortcuts
- **`deploy`** → `luna-deploy` - General deployment
- **`cf-deploy`** → `luna-cloudflare-deploy` - Cloudflare deployment with automation
- **`cf-auto`** → `luna-cloudflare-auto` - Automated Cloudflare setup with Wrangler

### Development Shortcuts
- **`plan`** → `luna-plan` - Create development plan
- **`execute`** → `luna-execute` - Execute planned tasks
- **`test`** → `luna-test` - Run tests and validation
- **`review`** → `luna-review` - Code review

### Analysis Shortcuts
- **`req`** → `luna-requirements` - Requirements analysis
- **`docs`** → `luna-docs` - Documentation generation
- **`monitor`** → `luna-monitor` - Monitoring setup
- **`postlaunch`** → `luna-postlaunch` - Post-launch review

### Configuration Shortcuts
- **`config`** → `luna-config` - Configuration management
- **`setup`** → Quick project setup wizard

## Shortcut Categories

### 🎨 Design & UI
| Shortcut | Command | Description |
|----------|---------|-------------|
| `hig` | `luna-hig` | Apple HIG compliance analysis |
| `design` | `luna-design-architect` | Technical design specifications |
| `ui-convert` | `luna-ui-convert` | Convert to Apple HIG + Decart design |
| `ui-test` | `luna-ui-test` | Playwright UI/UX testing |
| `ui-fix` | `luna-ui-fix` | Automated UI corrections |
| `responsive` | `luna-responsive-designer` | Responsive design optimization |
| `a11y` | `luna-accessibility-auditor` | Accessibility compliance |

### ☁️ Deployment & Infrastructure
| Shortcut | Command | Description |
|----------|---------|-------------|
| `deploy` | `luna-deploy` | General deployment |
| `cf-deploy` | `luna-cloudflare-deploy` | Cloudflare full deployment |
| `cf-auto` | `luna-cloudflare-auto` | Automated Cloudflare with Wrangler |
| `cf-workers` | `luna-cloudflare workers` | Deploy to Workers |
| `cf-pages` | `luna-cloudflare pages` | Deploy to Pages |
| `cf-d1` | `luna-cloudflare d1` | D1 database setup |
| `cf-r2` | `luna-cloudflare r2` | R2 storage setup |

### 🔧 Development & Testing
| Shortcut | Command | Description |
|----------|---------|-------------|
| `plan` | `luna-plan` | Development planning |
| `execute` | `luna-execute` | Task execution |
| `test` | `luna-test` | Testing & validation |
| `review` | `luna-review` | Code review |
| `e2e` | `luna-test e2e` | End-to-end testing |
| `unit` | `luna-test unit` | Unit testing |
| `integration` | `luna-test integration` | Integration testing |

### 📊 Analysis & Documentation
| Shortcut | Command | Description |
|----------|---------|-------------|
| `req` | `luna-requirements` | Requirements analysis |
| `docs` | `luna-docs` | Documentation generation |
| `monitor` | `luna-monitor` | Monitoring setup |
| `postlaunch` | `luna-postlaunch` | Post-launch review |
| `config` | `luna-config` | Configuration management |

## Advanced Shortcuts

### Workflow Shortcuts
Execute multiple commands in sequence:

- **`full-deploy`** → Requirements → Design → Execute → Test → Deploy → Monitor
- **`ui-pipeline`** → HIG Analysis → UI Convert → UI Test → UI Fix
- **`cf-full`** → Cloudflare Auto → Workers → Pages → D1 → R2 → Domain
- **`design-flow`** → Requirements → Design → HIG → Responsive → A11y

### Quick Commands
- **`quick-hig`** → Fast HIG compliance check
- **`quick-test`** → Quick UI/UX test suite
- **`quick-deploy`** → Fast deployment to Cloudflare
- **`quick-fix`** → Automated quick fixes

## Custom Shortcuts

### Create Custom Shortcut
```bash
luna-shortcuts create my-workflow "luna-requirements && luna-design && luna-execute"
```

### List Custom Shortcuts
```bash
luna-shortcuts list-custom
```

### Delete Custom Shortcut
```bash
luna-shortcuts delete my-workflow
```

## Shortcut Aliases

### Git-Style Aliases
- **`ls`** → List all shortcuts
- **`s`** → Search shortcuts
- **`c`** → Create shortcut
- **`d`** → Delete shortcut
- **`h`** → Help

### Quick Access
- **`?`** → Show help and available shortcuts
- **`!!`** → Re-run last shortcut
- **`!n`** → Run nth command from history

## Integration with Luna Ecosystem

The shortcuts system integrates with:
- **Luna Skills** - Direct access to all skills
- **Luna Commands** - Quick command execution
- **Luna Agents** - Agent invocation shortcuts
- **MCP Server** - Tool shortcuts for RAG and search

## Shortcut Configuration

### Configuration File
Shortcuts are stored in: `.luna/shortcuts.json`

```json
{
  "shortcuts": {
    "hig": "luna-hig",
    "ui-convert": "luna-ui-convert",
    "cf-deploy": "luna-cloudflare-deploy"
  },
  "workflows": {
    "full-deploy": [
      "luna-requirements",
      "luna-design",
      "luna-execute",
      "luna-test",
      "luna-deploy"
    ]
  },
  "custom": {
    "my-workflow": "custom command sequence"
  }
}
```

## Examples

### Quick HIG Analysis
```bash
luna-shortcuts hig
# Equivalent to: luna-hig
```

### UI Conversion Pipeline
```bash
luna-shortcuts ui-pipeline
# Runs: HIG Analysis → UI Convert → UI Test → UI Fix
```

### Cloudflare Full Deployment
```bash
luna-shortcuts cf-full
# Runs: Complete Cloudflare setup with all services
```

### Custom Workflow
```bash
luna-shortcuts create deploy-flow "luna-test && luna-cf-deploy && luna-monitor"
luna-shortcuts deploy-flow
```

## Keyboard Shortcuts (IDE Integration)

When integrated with IDE:
- **`Cmd+Shift+L`** → Open Luna shortcuts menu
- **`Cmd+Shift+H`** → Quick HIG analysis
- **`Cmd+Shift+D`** → Quick deploy
- **`Cmd+Shift+T`** → Quick test

## Output Files

- **`.luna/shortcuts.json`** - Shortcut configuration
- **`.luna/shortcuts-history.json`** - Command history
- **`.luna/shortcuts-custom.json`** - Custom shortcuts

Transform your Luna workflow with intelligent shortcuts and quick access! 🚀⚡
