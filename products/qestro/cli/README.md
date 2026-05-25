# Questro CLI - Professional Testing Automation Platform

[![npm version](https://badge.fury.io/js/qestro-cli.svg)](https://badge.fury.io/js/qestro-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Questro CLI is a professional command-line interface for the Questro testing automation platform. It provides comprehensive access to all backend capabilities including test recording, execution, project management, and analytics.

## 🚀 Features

- **Complete API Coverage**: Access all Questro platform features from the command line
- **Professional Design**: Built with the same quality standards as AWS CLI and other professional tools
- **Multiple Output Formats**: Support for table, JSON, and YAML output formats
- **Interactive Mode**: User-friendly interactive prompts for complex operations
- **Authentication Management**: Secure token handling with automatic refresh
- **Configuration Profiles**: Multiple profiles for different environments and teams
- **Comprehensive Error Handling**: Clear error messages with actionable suggestions
- **Real-time Progress**: Progress bars and status updates for long-running operations
- **Extensible Architecture**: Plugin-style command modules for easy extension

## 📦 Installation

### Global Installation

```bash
npm install -g qestro-cli
```

### Local Installation

```bash
npm install qestro-cli
```

### Development Installation

```bash
git clone https://github.com/qestro/qestro-cli.git
cd qestro-cli
npm install
npm run build
npm link
```

## 🔧 Quick Start

### 1. Authentication

First, authenticate with the Questro platform:

```bash
qestro auth login
```

Or use specific credentials:

```bash
qestro auth login --email user@example.com
```

### 2. Check Authentication Status

```bash
qestro auth status
```

### 3. Create Your First Project

```bash
qestro projects create --interactive
```

### 4. Start Recording

For web applications:

```bash
qestro recordings start --type web --url https://example.com
```

For mobile applications:

```bash
qestro recordings start --type mobile --device "iPhone 12"
```

## 📖 Command Reference

### Authentication (`qestro auth`)

| Command | Description | Example |
|---------|-------------|---------|
| `login` | Authenticate with Questro | `qestro auth login` |
| `logout` | Log out from Questro | `qestro auth logout` |
| `status` | Check authentication status | `qestro auth status` |
| `whoami` | Display current user information | `qestro auth whoami` |
| `refresh` | Refresh authentication token | `qestro auth refresh` |
| `change-password` | Change user password | `qestro auth change-password` |

### Projects (`qestro projects`)

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List all projects | `qestro projects list` |
| `create` | Create a new project | `qestro projects create --interactive` |
| `get <id>` | Get project details | `qestro projects get abc123` |
| `update <id>` | Update project details | `qestro projects update abc123 --name "New Name"` |
| `delete <id>` | Delete a project | `qestro projects delete abc123` |
| `set-default <id>` | Set default project | `qestro projects set-default abc123` |
| `get-default` | Get default project | `qestro projects get-default` |
| `stats [id]` | Show project statistics | `qestro projects stats` |

### Recordings (`qestro recordings`)

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List all recordings | `qestro recordings list` |
| `start` | Start a new recording session | `qestro recordings start --interactive` |
| `stop <id>` | Stop a recording session | `qestro recordings stop abc123` |
| `get <id>` | Get recording details | `qestro recordings get abc123` |
| `delete <id>` | Delete a recording | `qestro recordings delete abc123` |
| `download <id>` | Download recording file | `qestro recordings download abc123` |

### Configuration (`qestro config`)

| Command | Description | Example |
|---------|-------------|---------|
| `show` | Show current configuration | `qestro config show` |
| `set <key> <value>` | Set configuration value | `qestro config set api.timeout 30000` |
| `get <key>` | Get configuration value | `qestro config get api.baseUrl` |
| `validate` | Validate configuration | `qestro config validate` |
| `reset` | Reset to defaults | `qestro config reset` |
| `list-profiles` | List configuration profiles | `qestro config list-profiles` |

## ⚙️ Configuration

Questro CLI uses a configuration file stored in `~/.qestro/` to manage settings:

### Configuration Options

```json
{
  "api": {
    "baseUrl": "https://api.questro.io",
    "timeout": 30000,
    "retries": 3
  },
  "auth": {
    "accessToken": "...",
    "refreshToken": "...",
    "tokenExpiry": 1234567890
  },
  "defaults": {
    "project": "default-project-id",
    "region": "us-east-1",
    "outputFormat": "table",
    "pageSize": 25
  },
  "integrations": {
    "maestro": {
      "executablePath": "/usr/local/bin/maestro",
      "version": "1.30.0"
    },
    "playwright": {
      "executablePath": "/usr/local/bin/playwright",
      "browser": "chrome",
      "headless": false
    }
  }
}
```

### Configuration Profiles

You can create multiple configuration profiles for different environments:

```bash
# Switch to a different profile
qestro --profile production projects list

# Create a new profile
qestro config set api.baseUrl "https://api-prod.questro.io" --profile production
```

## 📊 Output Formats

Questro CLI supports multiple output formats:

### Table Format (Default)

```bash
qestro projects list --format table
```

```
┌──────────────┬─────────────────┬─────────┬──────────┬────────┬────────┐
│ ID           │ Name            │ Type    │ Platform │ Status │ Tests  │
├──────────────┼─────────────────┼─────────┼──────────┼────────┼────────┤
│ abc12345     │ My Mobile App    │ mobile  │ iOS      │ active │ 15     │
│ def67890     │ Web Dashboard    │ web     │ React    │ active │ 23     │
└──────────────┴─────────────────┴─────────┴──────────┴────────┴────────┘
```

### JSON Format

```bash
qestro projects list --format json
```

```json
[
  {
    "id": "abc12345",
    "name": "My Mobile App",
    "type": "mobile",
    "platform": "iOS",
    "status": "active",
    "statistics": {
      "testCount": 15
    }
  }
]
```

### YAML Format

```bash
qestro projects list --format yaml
```

```yaml
- id: abc12345
  name: My Mobile App
  type: mobile
  platform: iOS
  status: active
  statistics:
    testCount: 15
```

## 🔄 Global Options

These options can be used with any command:

| Option | Description | Example |
|--------|-------------|---------|
| `--verbose` | Enable verbose logging | `qestro --verbose projects list` |
| `--quiet` | Suppress non-error output | `qestro --quiet projects create` |
| `--no-color` | Disable colored output | `qestro --no-color projects list` |
| `--format <format>` | Set output format | `qestro --format json projects list` |
| `--profile <profile>` | Use specific profile | `qestro --profile prod projects list` |
| `--region <region>` | Specify region | `qestro --region us-west-2 projects list` |

## 🔌 Integrations

### Maestro (Mobile Testing)

Install Maestro for mobile testing:

```bash
# Install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# Verify installation
maestro --version
```

### Playwright (Web Testing)

Install Playwright for web testing:

```bash
# Install Playwright
npm install -g playwright

# Install browsers
npx playwright install
```

## 🛠️ Development

### Building from Source

```bash
git clone https://github.com/qestro/qestro-cli.git
cd qestro-cli
npm install
npm run build
npm link
```

### Running Tests

```bash
npm test
npm run test:coverage
npm run test:watch
```

### Code Quality

```bash
npm run lint
npm run lint:fix
npm run format
```

### Project Structure

```
cli/
├── src/
│   ├── commands/           # Command modules
│   │   ├── auth.ts        # Authentication commands
│   │   ├── projects.ts    # Project management
│   │   ├── recordings.ts  # Test recording
│   │   ├── tests.ts       # Test management
│   │   ├── analytics.ts   # Analytics & reporting
│   │   ├── config.ts      # Configuration
│   │   ├── deployment.ts  # Deployment & CI/CD
│   │   ├── integrations.ts # Third-party integrations
│   │   └── users.ts       # User management
│   ├── utils/             # Utility modules
│   │   ├── api-client.ts  # HTTP API client
│   │   ├── config.ts      # Configuration management
│   │   ├── logger.ts      # Logging system
│   │   ├── error-handler.ts # Error handling
│   │   └── output.ts      # Output formatting
│   └── index.ts           # Main entry point
├── package.json
├── tsconfig.json
└── README.md
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.questro.io/cli](https://docs.questro.io/cli)
- **Issues**: [GitHub Issues](https://github.com/qestro/qestro-cli/issues)
- **Community**: [Discord Server](https://discord.gg/qestro)
- **Email**: support@questro.io

## 🔗 Related Projects

- [Questro Platform](https://github.com/qestro/qestro) - Main Questro platform
- [Questro Desktop](https://github.com/qestro/qestro-desktop) - Desktop application
- [Questro VS Code](https://github.com/qestro/qestro-vscode) - VS Code extension

## 📋 Roadmap

- [ ] Complete test execution commands
- [ ] Advanced analytics and reporting
- [ ] CI/CD integration
- [ ] Plugin system
- [ ] Shell completion (bash, zsh, fish)
- [ ] Webhooks and integrations
- [ ] Performance monitoring
- [ ] Team collaboration features
- [ ] Advanced scheduling
- [ ] Custom reporting templates

---

**Built with ❤️ by the Questro Team**