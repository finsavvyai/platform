# CLI Reference

Complete reference for the `luna-agents` command-line tool.

## Installation

```bash
npm install -g luna-agents
```

## Commands

### `luna init`

Initialize LunaOS in your project.

```bash
luna init                 # Interactive setup
luna init --cloud         # Cloud mode with LunaOS account
luna init --provider anthropic  # Skip provider selection
```

**Creates:** `.luna/config.yaml` and `.luna/reports/`

### `luna list`

List all 28+ available agents.

```bash
luna list                 # Show all agents
luna list --category build  # Filter by category
luna list --json          # JSON output
```

**Categories:** build, quality, ship, intelligence, design, meta

### `luna run <agent>`

Execute a single agent.

```bash
luna run code-review              # Local mode (uses your API key)
luna run code-review --cloud      # Cloud mode (uses LunaOS API)
luna run code-review -f src/     # Target specific files
luna run code-review -o report.md # Custom output path
luna run code-review --provider anthropic --model claude-sonnet-4-20250514
```

### `luna chain <preset>`

Execute multi-agent chains.

```bash
luna chain full-review            # Run full code review chain
luna chain new-feature            # New feature analysis
luna chain deploy                 # Deployment readiness check
luna chain security-audit         # Security audit chain
luna chain api-design             # API design review
```

### `luna index`

Index your project for RAG-powered context.

```bash
luna index                # Local indexing
luna index --cloud        # Upload to LunaOS cloud
luna index --dry-run      # Preview without indexing
luna index --max-files 100  # Limit file count
```

### `luna login`

Authenticate with LunaOS cloud.

```bash
luna login                # Interactive email/password
luna login --browser      # OAuth in browser
luna login --key <apiKey> # Direct API key
luna login --status       # Check auth status
luna login --logout       # Remove credentials
```

### `luna keys`

Manage LLM provider API keys.

```bash
luna keys list            # Show configured keys
luna keys add anthropic   # Add/update a key
luna keys remove openai   # Remove a key
luna keys test            # Validate all keys
```

### `luna config`

View and manage configuration.

```bash
luna config list          # Show all config
luna config get provider  # Get specific value
luna config set model gpt-4o  # Set globally
luna config set model gpt-4o -p  # Set per-project
luna config path          # Show config file locations
```

### `luna status`

Show project status.

```bash
luna status               # Full status display
```

### `luna create-agent <name>`

Create a custom agent persona.

```bash
luna create-agent my-reviewer -d "Reviews Python code" -c code-quality
luna create-agent my-reviewer --global  # Save globally
```

## Configuration

### Project Config (`.luna/config.yaml`)

```yaml
version: '1.0'
project: my-app
provider: anthropic
model: claude-sonnet-4-20250514
output:
  dir: .luna/reports
  format: markdown
```

### Global Config (`~/.luna/config.yaml`)

Same structure, applies to all projects.

### Credentials (`~/.luna/credentials.yaml`)

```yaml
ANTHROPIC_API_KEY: sk-ant-...
OPENAI_API_KEY: sk-proj-...
cloud_token: lnos_live_...
```

## Supported Providers

| Provider | Env Variable | Default Model |
|----------|-------------|---------------|
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| OpenAI | `OPENAI_API_KEY` | gpt-4o |
| DeepSeek | `DEEPSEEK_API_KEY` | deepseek-chat |
| Google | `GOOGLE_AI_API_KEY` | gemini-pro |
| xAI | `XAI_API_KEY` | grok-beta |
| Groq | `GROQ_API_KEY` | llama-3.1-70b |
| Mistral | `MISTRAL_API_KEY` | mistral-large |
| Cohere | `COHERE_API_KEY` | command-r-plus |
| Perplexity | `PERPLEXITY_API_KEY` | llama-3.1-sonar |
| Together | `TOGETHER_API_KEY` | meta-llama/Llama-3-70b |
| Fireworks | `FIREWORKS_API_KEY` | llama-v3p1-70b |
| OpenRouter | `OPENROUTER_API_KEY` | auto |
