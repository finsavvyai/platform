# 🌙 Luna CLI — AI Agent Platform for the Full SDLC

[![npm version](https://img.shields.io/npm/v/@luna-agents/cli.svg)](https://www.npmjs.com/package/@luna-agents/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

Run **28+ specialized AI agents** from your terminal — code review, testing, security audits, documentation, deployment, and more. Powered by [LunaOS](https://lunaos.ai).

## Quick Start

```bash
# Install globally
npm i -g @luna-agents/cli

# Initialize in your project
luna init

# Run your first agent
luna run code-review
```

## Features

- 🤖 **28+ AI Agents** — specialists for every stage of the software development lifecycle
- 🔗 **Agent Chains** — multi-agent workflows (e.g., review → test → document)
- 📚 **RAG Indexing** — index your codebase for context-aware analysis
- 🌐 **Multi-Provider** — Anthropic, OpenAI, Google, DeepSeek, Groq, Mistral, and more
- ☁️ **Cloud Mode** — optional cloud execution via LunaOS API
- 🎨 **Custom Agents** — create your own agent personas

## Commands

| Command | Description |
|---------|-------------|
| `luna init` | Initialize LunaOS in your project |
| `luna list` | List all available agents |
| `luna run <agent>` | Run an agent on your project |
| `luna chain <preset>` | Run a multi-agent chain |
| `luna index` | Index project for RAG context |
| `luna config` | View and manage configuration |
| `luna keys` | Manage API keys |
| `luna create-agent` | Scaffold a custom agent |
| `luna status` | Show project status |

## Agent Categories

| Category | Agents |
|----------|--------|
| **Code Quality** | Code Review, Refactoring, Performance, Accessibility |
| **Testing** | Testing & Validation, Security Scanner, Load Testing |
| **Documentation** | Documentation, API Generator, Changelog |
| **Deployment** | Deployment, CI/CD Generator, Infrastructure |
| **Design** | Design Architect, UX Analyzer, Design System |
| **Data** | Database Architect, Data Pipeline, Migration |
| **DevOps** | Monitoring, Incident Response, Cost Optimizer |
| **Planning** | Requirements Analyzer, Sprint Planner, Tech Debt |

## Preset Chains

Run multi-agent pipelines with a single command:

```bash
luna chain full-review       # Code Review → Testing → Documentation
luna chain new-feature       # Requirements → Design → Planning → Execution
luna chain deploy            # Code Review → Testing → Deployment
luna chain security-audit    # Security Scan → Code Review
luna chain api-design        # API Generator → Database → Documentation
```

## Configuration

```bash
# Set provider and model
luna config set provider openai
luna config set model gpt-4o

# Manage API keys
luna keys add anthropic
luna keys add openai
luna keys test anthropic

# Cloud mode
luna init --cloud            # Sign up / log in
luna run code-review --cloud # Run via cloud API
```

### Config Locations

| File | Scope | Purpose |
|------|-------|---------|
| `~/.luna/config.yaml` | Global | Default provider, model |
| `.luna/config.yaml` | Project | Project-specific overrides |
| `~/.luna/credentials.yaml` | Global | API keys (chmod 600) |

## Custom Agents

Create your own agent personas:

```bash
luna create-agent my-reviewer --category code-quality
luna create-agent security-scan --category security --global
luna run my-reviewer
```

## Cloud Mode

Connect to [LunaOS Cloud](https://agents.lunaos.ai) for:
- Remote agent execution (no local API key needed)
- Agent chains with SSE streaming
- RAG-enhanced analysis with cloud indexing

```bash
luna init --cloud
luna run code-review --cloud
luna chain full-review
luna index --cloud
```

## Requirements

- **Node.js** ≥ 18.0.0
- **npm** ≥ 8
- An API key from any supported provider (or LunaOS Cloud account)

## License

MIT © [Shachar Solomon](https://github.com/shacharsolomon)

---

Built with ❤️ by [LunaOS](https://lunaos.ai)
