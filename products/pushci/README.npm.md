# PushCI

[![npm version](https://img.shields.io/npm/v/pushci.svg)](https://www.npmjs.com/package/pushci)
[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-blue.svg)](LICENSE)
[![CI](https://github.com/finsavvyai/pushci/actions/workflows/ci.yml/badge.svg)](https://github.com/finsavvyai/pushci/actions/workflows/ci.yml)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple.svg)](https://pushci.dev/ai)

**Zero-config AI CI/CD. Runs on your machine. Free forever.**

> 35 languages. 39 frameworks. 22 deploy targets. Zero YAML.
> One command to set up CI. $0 to run it.

```bash
npm install -g pushci   # one-time install
pushci init             # AI detects your stack in 30 seconds
git push                # tests run automatically
```

<!-- TODO: Add 30-second demo GIF here -->
<!-- ![PushCI Demo](assets/demo.gif) -->

## Why PushCI?

GitHub Actions charges $0.008/min for hosted runners and $0.002/min for self-hosted runners (as of March 2026). PushCI runs on your machine for $0 — always.

| | PushCI | GitHub Actions | GitLab CI | Jenkins |
|--|---------|---------------|-----------|---------|
| **Setup** | 30 seconds | 30+ minutes | 30+ minutes | Hours |
| **Config** | Zero (AI) | 50+ lines YAML | 50+ lines YAML | Groovy DSL |
| **Cost** | $0 (your machine) | $0.008/min (hosted) / $0.002/min (self-hosted, as of 2026) | $0.008/min | Server costs |
| **Platforms** | GitHub + GitLab + BB | GitHub only | GitLab only | All |
| **AI** | Auto-detects stack | None | None | None |

## Quick Start

```bash
# Install (pick one)
npm install -g pushci                                          # npm (recommended)
brew install finsavvyai/tap/pushci                             # Homebrew
curl -fsSL https://pushci.dev/install.sh | sh                  # Script

# Auto-detect your stack
pushci init

# Run CI locally
pushci run

# Something broken? Get actionable fixes
pushci troubleshoot

# Start webhook agent
GITHUB_TOKEN=xxx pushci agent
```

## AI Agent Integration (MCP)

PushCI includes an MCP server for AI coding agents like **Claude Code**, **Cursor**, **Windsurf**, and **Cline**.

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

**Available tools**: `pushci_init` (detect stack), `pushci_run` (run pipeline), `pushci_status` (check results), `pushci_doctor` (diagnose env), `pushci_secret_set` (store secrets).

**Natural language**: `pushci ask "set up CI for this project"`

## Supported

**35 Languages**: Go, Node/TS, Python, Rust, Java, C#,
Ruby, PHP, Swift, Dart, Elixir, Zig, Scala, Haskell,
Kotlin, Lua, Perl, R, Julia, OCaml, Nim, Crystal, Bicep +more

**39 Frameworks**: Next.js, Nuxt, SvelteKit, Django, FastAPI,
Flask, Spring Boot, Rails, Laravel, Phoenix, Flutter +more

**22 Deploy Targets**: Cloudflare (Pages/Workers), AWS (ECS/Lambda/S3),
GCP (Cloud Run/App Engine), Azure (App Service/Functions/Bicep),
Vercel, Railway, Fly, Render, Netlify, Docker, K8s, SSH,
Terraform, CloudFormation, Pulumi, Ansible

## Messaging Channels

Control your CI/CD from WhatsApp, Slack, Discord, Telegram, or any webhook.

```
"run tests"        → PushCI runs your pipeline
"deploy staging"   → Deploys to staging
"status"           → Shows last run result
"diagnose"         → AI root-cause analysis
```

Connect from the dashboard at **app.pushci.dev/channels**, or via API:

```bash
curl -X POST https://api.pushci.dev/api/channels/connect \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"channelType":"slack","credentials":{"accessToken":"xoxb-...","teamId":"T123"}}'
```

Supported platforms:

| Platform | Webhook | Response Limit |
|----------|---------|----------------|
| WhatsApp | Meta Business API | 4,000 chars |
| Slack | Events API | 39,000 chars |
| Discord | Interactions | 2,000 chars |
| Telegram | Bot API | 4,000 chars |
| Custom | Webhook | 40,000 chars |

## Commands

```
pushci init         Detect stack and generate pushci.yml
pushci run          Execute pipeline checks
pushci deploy       Deploy to target environment
pushci diagnose     AI-diagnose failed runs
pushci status       Show last run results
pushci secret       Manage encrypted secrets
pushci heal         AI self-heal broken pipeline
pushci ask          Natural language CI commands
pushci generate     AI-generate pushci.yml
pushci migrate      Convert GitHub Actions workflow
pushci mcp          Start MCP server for AI agents
pushci agent        Start webhook agent server
pushci index        Build dependency graph for blast radius
pushci skill        Install/list/remove marketplace skills
pushci login        Authenticate with PushCI (Pro)
pushci logout       Remove saved credentials
pushci doctor       Check environment health
pushci troubleshoot Diagnose issues with actionable fixes
pushci trace        View Perfetto performance traces
pushci release      Build & publish release locally ($0)
pushci promote      Register with AI registries
pushci voice        TTS narration for runs (curb / office / deadpan-tech)
pushci uninstall    Remove hooks, config, and .pushci
pushci version      Print version
```

See [docs/CLI.md](docs/CLI.md) for the full CLI reference with flags, examples, and plan requirements.

## Voice

PushCI narrates your pipeline. Pick a persona, run your pipeline, hear it. Phrases are pre-canned by default; with an AI key you get fresh in-character lines per run.

```bash
pushci voice list                              # show built-in personas
pushci voice say "deploying" --persona curb-style
pushci voice test --persona office-style       # demo all 6 lifecycle events
pushci voice joke --diff main                  # AI riffs on the diff vs main
pushci run --voice                             # auto-narrate pipeline events
```

Built-in personas:

| Persona | Style |
|---|---|
| `curb-style` | Petty frustration, awkward incredulity |
| `office-style` | Oblivious enthusiasm, motivational confusion |
| `deadpan-tech` | Sysadmin superiority, dark contempt |
| `deadpan-narrator` | Neutral, no character |

Defaults are zero-config: macOS `say` backend, no API keys, no network. Add `--ai` (or `PUSHCI_VOICE_AI=1` for `pushci run`) to switch on AI commentary via any of the 7 supported providers (`ANTHROPIC_API_KEY` / `GROQ_API_KEY` / `DEEPSEEK_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / local llamafile / PushCI proxy).

Safety: every utterance passes through a redactor (JWTs, AWS ARNs, account IDs, API keys, IPs, internal hostnames, emails are masked) and AI output runs through a content filter (rejects profanity + prompt-injection echo). Mute everything with `PUSHCI_VOICE_OFF=1`.

Bring your own personas via `~/.pushci/voices.yml` — user entries appear in `pushci voice list` alongside the built-ins and override on name collision:

```yaml
personas:
  - name: pirate-style
    voice: Daniel        # macOS voice; run `say -v ?` to enumerate
    description: Pirate-themed deploy commentary
    phrases:
      start: ["Aye, hoist the colors. Deploying."]
      pass:  ["Ye scurvy tests passed."]
      fail:  ["Avast, the build hath sunk."]
```

## Secrets

PushCI resolves secret references inline in `pushci.yml` env blocks.
Three schemes are supported today; PushCI never writes a plaintext
secret to disk it didn't already encrypt.

| Scheme | Backed by | Best for |
|---|---|---|
| `keychain://service[#account]` | macOS Keychain / Windows Credential Manager / Linux Secret Service, with AES-encrypted fallback at `~/.pushci/keychain.enc` for headless CI | Local dev, individual machines |
| `vault://path#field` | HashiCorp Vault AppRole (`VAULT_ADDR` + `VAULT_ROLE_ID` + `VAULT_SECRET_ID`) | Teams, audited environments |
| `pushci secrets set KEY VAL` | Per-project AES file at `.pushci/secrets.enc`, machine-bound | Quick one-offs, throwaway scripts |

```yaml
# pushci.yml
stages:
  - name: publish
    env:
      NPM_TOKEN: keychain://npm-publish-token
      DEPLOY_KEY: keychain://deploy-bot#prod
      DB_PASSWORD: vault://secret/data/prod/db#password
    checks:
      - name: publish
        run: npm publish
```

**Managing keychain entries from the CLI:**

```bash
pushci secrets keychain set npm-publish-token npm_xxxxxxxxxxxx
pushci secrets keychain set deploy-bot#prod  s3cr3t
pushci secrets keychain get npm-publish-token
pushci secrets keychain list      # fallback-file entries only
pushci secrets keychain rm  npm-publish-token
```

On macOS the storage layout matches the `security` CLI verbatim, so the
common `.zshrc` helper functions work side-by-side:

```bash
secret()     { security find-generic-password -a "$USER" -s "$1" -w 2>/dev/null; }
secret-set() { security add-generic-password    -a "$USER" -s "$1" -w "$2" -U; }
```

Entries written by `secret-set` are readable by `pushci secrets keychain
get`, and vice versa — no `go-keyring-base64:` prefix gymnastics.

**Headless Linux CI:** when D-Bus and Secret Service aren't running,
PushCI falls back transparently to an AES-encrypted file at
`~/.pushci/keychain.enc` with a machine-bound key. A one-time stderr
warning fires the first time a fallback read or write happens, so the
behavior is never silent. Override account default with the `#account`
suffix; the current OS user is used when omitted.

## Configuration

`pushci.yml` is optional — `pushci init` generates one that works, and
zero-config mode auto-detects your stack. When you want more control,
PushCI supports three authoring styles. Full reference is at
[pushci.dev/docs/pushci-yaml](https://pushci.dev/docs/pushci-yaml).

### Simple example

Zero-config Node.js app with linear stages, single-target deploy on
`main`, and Slack notifications. Drop this into your repo as
`pushci.yml` and run `pushci run`.

```yaml
on: [push, pull_request]

stages:
  - name: install
    checks:
      - name: deps
        run: pnpm install --frozen-lockfile

  - name: lint
    depends_on: [install]
    checks:
      - name: eslint
        run: pnpm lint

  - name: test
    depends_on: [install]
    checks:
      - name: vitest
        run: pnpm test

  - name: build
    depends_on: [install, lint, test]
    checks:
      - name: next-build
        run: pnpm build

deploy:
  trigger: push
  only_on: [main]
  run: npx wrangler pages deploy dist --project-name=my-app

notify:
  slack: "${{ secrets.SLACK_WEBHOOK }}"
```

### Complex example — every feature

Parallel stages, cross-stage DAG, conditional checks, retries,
timeouts, Docker-isolated steps, multi-environment staged deploy with
an approval gate on production, and stage-scoped secrets.

```yaml
on: [push, pull_request, workflow_dispatch]

stages:
  - name: install
    checks:
      - name: pnpm-install
        run: pnpm install --frozen-lockfile
        retry: 2
        timeout: 3m

  - name: quality
    depends_on: [install]
    parallel: true            # every check runs concurrently
    env:
      NODE_ENV: test
    checks:
      - name: typecheck
        run: pnpm tsc --noEmit
      - name: lint
        run: pnpm lint
      - name: format
        run: pnpm prettier --check .
      - name: audit
        run: pnpm audit --audit-level=high
        on_fail: warn         # log but don't fail the stage

  - name: test
    depends_on: [install]
    parallel: true
    env:
      DATABASE_URL: postgres://test:test@localhost:5432/test
    checks:
      - name: unit
        run: pnpm test:unit --coverage
      - name: integration
        run: pnpm test:integration
        retry: 1
        timeout: 5m
      - name: e2e
        if: branch == 'main' || branch =~ '^release/'
        run: pnpm test:e2e
        docker: mcr.microsoft.com/playwright:v1.49.0-focal
        timeout: 10m

  - name: security
    depends_on: [install]
    checks:
      - name: secret-scan
        run: npx gitleaks detect --no-git
      - name: sast
        run: pushci scan --engine claude --fail-on high

  - name: build
    depends_on: [quality, test, security]
    checks:
      - name: next-build
        run: pnpm build
      - name: bundle-size
        run: npx size-limit
        line-limit: 10

deploy:
  trigger: push
  environments:
    - name: staging
      only_on: [develop]
      run: npx wrangler pages deploy dist --project-name=app-staging
      env:
        CF_API_TOKEN: "${{ secrets.CF_API_TOKEN_STAGING }}"
    - name: production
      only_on: [main]
      approve: true           # requires interactive approval
      run: npx wrangler pages deploy dist --project-name=app-prod
      env:
        CF_API_TOKEN: "${{ secrets.CF_API_TOKEN_PROD }}"

notify:
  slack: "${{ secrets.SLACK_WEBHOOK }}"
  discord: "${{ secrets.DISCORD_WEBHOOK }}"
  email: oncall@example.com
```

### GitHub Actions parity — no rewrite needed

PushCI v1.3.1+ runs your existing `.github/workflows/*.yml` files
end-to-end via the embedded [nektos/act](https://github.com/nektos/act)
runtime. `actions/checkout@v4`, matrix builds, service containers,
composite actions, secret masking, `needs.*.outputs.*` — all work.
Just drop in a workflow and run:

```bash
pushci actions run                 # runs all .github/workflows/*.yml
pushci actions run --job test      # run one job
pushci actions run --dry-run       # validate without containers
pushci actions doctor              # check act + docker + workflow status
```

A real complex workflow that runs unchanged:

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node: [20, 22]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm test
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/postgres
      - id: coverage
        run: echo "pct=$(npm test --silent)" >> $GITHUB_OUTPUT
    outputs:
      coverage: ${{ steps.coverage.outputs.pct }}

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: echo "coverage was ${{ needs.test.outputs.coverage }}"
        env:
          CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

Or just run `pushci init` — PushCI figures everything out automatically.

## Git Hook

`pushci init` installs a pre-push hook that runs checks before every push.
The hook is designed to never block your workflow:

- **Skip once**: `git push --no-verify`
- **Disable permanently**: `export PUSHCI_SKIP_HOOK=1`
- **Auto-skips** if the pushci binary is unavailable (no download hang)

## Pricing

| Free | Pro $9/mo | Team $29/seat/mo | Enterprise |
|------|-----------|-------------------|------------|
| Unlimited local runs | Unlimited repos | Everything in Pro | Everything in Team |
| AI stack detection | AI diagnosis (100/mo) | 2000 cloud minutes | Unlimited cloud minutes |
| 2 deploy targets | 22 deploy targets | SSO / SAML | SCIM + 7-year audit |
| Community support | Dashboard + analytics | Audit logs + governance | Dedicated tenant option |

## Links

- **Website**: https://pushci.dev
- **AI Agents**: https://pushci.dev/ai
- **Cost Calculator**: https://pushci.dev/tools/cost-calculator
- **Compare**: [vs GitHub Actions](https://pushci.dev/vs/github-actions) | [vs GitLab CI](https://pushci.dev/vs/gitlab-ci) | [vs CircleCI](https://pushci.dev/vs/circleci) | [vs Jenkins](https://pushci.dev/vs/jenkins)

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and contribution guidelines.

**Good first issues:**
- Add a framework detector (`internal/detect/`)
- Add a deploy target (`internal/deploy/`)
- Improve CLI error messages
- Add tests

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for our disclosure policy.

## License

[BSL 1.1](LICENSE) (Business Source License). Free to use for any purpose except
offering a competing hosted CI/CD service. Converts to MIT on 2029-04-06.

PushCI is a trademark of FinsavvyAI. See [LICENSE](LICENSE) for full terms.
