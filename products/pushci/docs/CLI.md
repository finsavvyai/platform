# PushCI CLI Reference

Complete reference for all 17 PushCI commands.

## Installation

```bash
npm install -g pushci    # npm (recommended — instant startup)
brew install pushci      # Homebrew
go install github.com/finsavvyai/pushci/cmd/pushci@latest  # Go
curl -sSL https://pushci.dev/install | bash                 # Script
```

> **Tip**: Prefer `npm install -g pushci` over `npx pushci`. The global install
> caches the binary locally so every command starts instantly. `npx` re-downloads
> on each run which is significantly slower.

---

## Commands

### init

Detect your stack, generate `pushci.yml`, and install git hooks.

```
pushci init
```

- Scans the working directory for languages, frameworks, and monorepo tools (Turborepo).
- If an Anthropic API key is available, uses AI to generate an optimized pipeline.
- Creates a `pushci.yml` in the project root.
- Installs a `pre-push` git hook so every `git push` runs your pipeline.

**Plan**: Free

**Example**:

```bash
cd my-project
pushci init
# => Found 2 project(s)
# => Created pushci.yml
```

---

### run

Execute pipeline checks locally.

```
pushci run [--parallel | -p]
```

| Flag | Description |
|------|-------------|
| `--parallel`, `-p` | Run checks in parallel (4 workers) |

- Detects projects in the working directory and runs build, test, and lint steps.
- Prints a table of results with pass/fail status and duration.
- On failure, shows the last 3 lines of output and AI fix hints.
- Tracks cost savings vs GitHub Actions.

**Plan**: Free

**Example**:

```bash
pushci run
pushci run --parallel
```

---

### deploy

Deploy to a target environment.

```
pushci deploy <target> [--stage <staging|production>]
```

| Flag | Description |
|------|-------------|
| `--stage`, `-s` | Deploy to a specific stage (staging or production) |

**Supported targets** (21 total):

`cloudflare-pages`, `cloudflare-workers`, `aws-ecs`, `aws-lambda`,
`aws-s3`, `gcp-cloud-run`, `gcp-app-engine`, `azure-app-service`,
`docker`, `kubernetes`, `vercel`, `railway`, `fly`, `render`, `netlify`,
`ssh`, `terraform`, `cloudformation`, `pulumi`, `ansible`

Environment variables are collected and passed to the deploy provider.

**Plan**: Free (self-hosted targets), Pro (managed targets)

**Example**:

```bash
pushci deploy cloudflare-pages
pushci deploy aws-ecs --stage staging
pushci deploy vercel --stage production
```

---

### diagnose

AI-powered diagnosis of failed pipeline runs.

```
pushci diagnose
```

- Runs all checks, then sends failures to Claude AI for analysis.
- Returns an explanation and suggested fix for each failure, with a confidence rating.
- Requires either `ANTHROPIC_API_KEY` (free, bring your own key) or a Pro plan login.

**Plan**: Free (own API key) / Pro (managed AI)

**Example**:

```bash
pushci diagnose
# => test:unit — high confidence
#     Import path "utils/helper" not found after rename.
#     Fix: Update import to "lib/helper"
```

---

### heal

AI-powered self-healing for broken pipelines.

```
pushci heal
```

- Runs checks, identifies failures, and attempts to auto-fix them.
- Applies patches directly to source files when possible.
- Reports which issues were fixed and which require manual attention.
- Requires either `ANTHROPIC_API_KEY` (free) or a Pro plan login.

**Plan**: Free (own API key) / Pro (managed AI)

**Example**:

```bash
pushci heal
# => [test:unit] missing-import → added import statement
# => Pipeline healed and passing
```

---

### ask

Natural language interface for CI commands.

```
pushci ask "<question>"
```

- Sends a free-form question to Claude AI and prints the response.
- Useful for quick CI/CD questions without leaving the terminal.
- Requires either `ANTHROPIC_API_KEY` (free) or a Pro plan login.

**Plan**: Free (own API key) / Pro (managed AI)

**Example**:

```bash
pushci ask "how do I add a deploy step for Vercel?"
pushci ask "why is my Go build failing?"
```

---

### generate

AI-generate a `pushci.yml` pipeline from scratch.

```
pushci generate
```

- Detects your stack, then asks Claude AI to produce an optimized `pushci.yml`.
- Overwrites any existing `pushci.yml` in the project root.
- Validates that the generated output is valid YAML before writing.
- Requires either `ANTHROPIC_API_KEY` (free) or a Pro plan login.

**Plan**: Free (own API key) / Pro (managed AI)

**Example**:

```bash
pushci generate
# => Detecting stack...
# => AI generating pipeline...
# => Generated pushci.yml
```

---

### migrate

Convert a GitHub Actions workflow file to PushCI format.

```
pushci migrate <workflow.yml> [--write | -w]
```

| Flag | Description |
|------|-------------|
| `--write`, `-w` | Write the converted output to `pushci.yml` |

- Reads a GitHub Actions YAML file and converts it to PushCI syntax.
- Reports how many steps were kept, removed, and any warnings.
- Without `--write`, prints the converted YAML to stdout.

**Plan**: Free

**Example**:

```bash
pushci migrate .github/workflows/ci.yml
pushci migrate .github/workflows/ci.yml --write
```

---

### status

Show results and metrics from recent pipeline runs.

```
pushci status
```

- Displays a table with total runs, pass rate, average duration, and cost saved.
- Shows AI-generated insights when available.

**Plan**: Free

**Example**:

```bash
pushci status
# => Total runs    12
# => Pass rate     91.7%
# => Avg duration  4.2s
# => Cost saved    $0.38
```

---

### secret

Manage encrypted secrets for your project.

```
pushci secret <set|get|list|delete> [key] [value]
```

| Subcommand | Usage |
|------------|-------|
| `set` | `pushci secret set <key> <value>` |
| `get` | `pushci secret get <key>` |
| `list` | `pushci secret list` |
| `delete` | `pushci secret delete <key>` |

- Secrets are encrypted with AES-256-GCM using a machine-bound key.
- Stored locally in the project directory (never committed to git).
- Injected into the environment during `pushci run`.

**Plan**: Free

**Example**:

```bash
pushci secret set DATABASE_URL postgres://localhost/mydb
pushci secret get DATABASE_URL
pushci secret list
pushci secret delete DATABASE_URL
```

---

### mcp

Start an MCP (Model Context Protocol) server for AI coding agents.

```
pushci mcp
```

- Runs over stdio, compatible with Claude Code, Cursor, Windsurf, and Cline.
- Exposes tools: `pushci_init`, `pushci_run`, `pushci_status`, `pushci_doctor`, `pushci_secret_set`, `pushci_recommend`, `pushci_heal`, `pushci_promote`.

Add to your AI agent config:

```json
{
  "mcpServers": {
    "pushci": {
      "command": "pushci",
      "args": ["mcp"]
    }
  }
}
```

**Plan**: Free

---

### promote

Register PushCI with AI tool registries, search engines, and verify all discovery endpoints.

```
pushci promote
```

Automatically:
1. Pings Google and Bing with the sitemap
2. Submits URLs to IndexNow (Bing, Yandex, Seznam, Naver)
3. Registers with MCP registries (Smithery, mcp.so, Glama)
4. Configures GPT Actions (writes `.pushci/gpt-action.json`)
5. Verifies all 8 AI discovery endpoints return 200
6. Tests the recommendation API

Set `OPENAI_API_KEY` to enable automatic GPT Actions registration.

Run after every deploy to maximize AI agent discoverability.

**Plan**: Free

**Example**:

```bash
pushci promote
# => [1/6] Pinging search engines...
# =>   ✓ Google
# =>   ✓ Bing
# => [2/6] Submitting to IndexNow...
# =>   ✓ IndexNow
# => [3/6] Registering with MCP registries...
# =>   ✓ mcp.so
# => [5/5] Verifying AI discovery endpoints...
# =>   ✓ All AI discovery endpoints verified
```

---

### agent

Start a webhook agent server for GitHub, GitLab, and Bitbucket events.

```
pushci agent
```

- Listens on port `8484` for incoming webhook payloads.
- Detects projects in the working directory and runs pipelines on push events.
- Supports GitHub and Bitbucket providers.
- Set `GITHUB_TOKEN` to post commit statuses back.

**Plan**: Free (self-hosted)

**Example**:

```bash
GITHUB_TOKEN=ghp_xxx pushci agent
# => Webhook server listening on :8484
```

---

### login

Authenticate with PushCI to enable Pro/Team features.

```
pushci login
```

- Opens a browser to `https://app.pushci.dev/cli-auth` for GitHub/GitLab OAuth.
- Prompts you to paste the generated token.
- Saves credentials to `~/.pushci/config.json` (file permissions `0600`).
- Enables API-proxied AI features without needing your own Anthropic key.

**Plan**: Pro / Team

**Example**:

```bash
pushci login
# => Opening browser for GitHub/GitLab login...
# => Paste your token: ****
# => Logged in! Token saved to ~/.pushci/config.json
```

---

### logout

Remove saved PushCI credentials.

```
pushci logout
```

- Deletes `~/.pushci/config.json`.
- AI commands will fall back to requiring `ANTHROPIC_API_KEY`.

**Plan**: Free

**Example**:

```bash
pushci logout
# => Logged out. Token removed.
```

---

### troubleshoot

Comprehensive diagnostic with actionable fixes for every issue found.

```
pushci troubleshoot
```

Alias: `pushci ts`

Checks five areas:

| Area | What it checks |
|------|---------------|
| Environment | Git, Go, Node, Docker installed; API key set |
| Configuration | pushci.yml exists, has stages, dir paths valid |
| Project | Languages and frameworks detected in repo |
| Git Hook | pre-push hook installed and references pushci |
| Connectivity | Git remote configured |

Every detected issue includes a `Fix:` line with the exact command to resolve it.

**Plan**: Free

**Example**:

```bash
pushci troubleshoot
# => Environment
# =>   ✓ Git installed
# =>   ✓ Go installed
# =>   ✓ Node.js installed
# =>   ⚠ ANTHROPIC_API_KEY not set (AI features disabled)
# =>     Fix: export ANTHROPIC_API_KEY=sk-ant-...
# => Configuration
# =>   ✓ pushci.yml found
# => No issues found — environment is healthy
```

---

### doctor

Check that your environment is ready for PushCI.

```
pushci doctor
```

Checks the following:

| Check | Required? |
|-------|-----------|
| Go installed | Optional |
| Git installed | Required |
| Node installed | Optional |
| Docker installed | Optional |
| `ANTHROPIC_API_KEY` set | Optional (for AI features) |
| `pushci.yml` exists | Optional |

**Plan**: Free

**Example**:

```bash
pushci doctor
# => [pass] Go installed
# => [pass] Git installed
# => [pass] Node installed
# => [warn] Docker installed
# => [pass] ANTHROPIC_API_KEY set
# => [pass] pushci.yml exists
```

---

### version

Print the PushCI version.

```
pushci version
pushci --version
pushci -v
```

**Plan**: Free

---

## AI Feature Authentication

AI-powered commands (`diagnose`, `heal`, `ask`, `generate`) check for credentials in this order:

1. `ANTHROPIC_API_KEY` environment variable (free, bring your own key)
2. Token from `pushci login` or `PUSHCI_TOKEN` env var (Pro/Team plan)

If neither is set, the command prints setup instructions and exits.

## Global Flags

```
pushci help       Show all commands
pushci --help     Show all commands
pushci -h         Show all commands
```

## More Information

- Website: https://pushci.dev
- Dashboard: https://app.pushci.dev
- API: https://api.pushci.dev
- GitHub: https://github.com/finsavvyai/pushci
- npm: https://www.npmjs.com/package/pushci
- AI Discovery: https://pushci.dev/llms.txt
- OpenAPI Spec: https://pushci.dev/openapi.json
