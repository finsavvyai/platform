# Getting Started with PushCI

## Install

```bash
npx pushci init
```

This scans your repo, detects languages and frameworks, generates a
`pushci.yml`, and installs git hooks. No account needed.

## Run Your Pipeline

```bash
pushci run
```

Executes build, test, and lint steps locally. Output is color-coded
with timing for each step.

## Configuration (Optional)

PushCI auto-generates `pushci.yml`. Edit it to customize:

```yaml
steps:
  - name: build
    run: go build ./...
  - name: test
    run: go test ./...
  - name: lint
    run: npm run lint
    dir: web/

deploy:
  target: cloudflare
  project: my-app
```

Most projects need zero customization.

## Deploy

Add a deploy section to `pushci.yml`:

```yaml
deploy:
  target: cloudflare    # or: aws, vercel, railway, fly, etc.
  project: my-app
  branch: main
```

Supported targets: Cloudflare, AWS, GCP, Azure, Vercel, Railway,
Fly, Netlify, Kubernetes, Docker, SSH, and more (16 total).

## Secrets

Store secrets locally (never committed to git):

```bash
pushci secret set DATABASE_URL=postgres://localhost/mydb
pushci secret set DEPLOY_TOKEN=abc123
pushci secret list
```

Secrets are encrypted at rest and injected during `pushci run`.

## Troubleshoot

Diagnose issues with actionable fixes:

```bash
pushci troubleshoot
```

Checks environment, config, project detection, git hook, and
connectivity. Every issue includes a `Fix:` with the exact command.

## Doctor

Quick environment health check:

```bash
pushci doctor
```

Checks: git, language runtimes, Docker, `.git` directory,
`pushci.yml`, and hook installation.

## Dashboard

View run history, status, and logs in the browser:

```
https://pushci-app.pages.dev
```

Connect your repo to see CI results across your team. Free tier
includes one project.

## Git Hooks

PushCI installs a pre-push hook automatically. Every `git push`
runs your pipeline first. Skip once with `git push --no-verify`.
Reinstall hooks with `pushci init --hooks`.

## Login

Authenticate with PushCI to unlock Pro features (managed AI, dashboard,
analytics) without needing your own Anthropic API key:

```bash
pushci login
```

This opens your browser for GitHub/GitLab OAuth. Paste the token when
prompted. Credentials are saved to `~/.pushci/config.json`.

Log out at any time:

```bash
pushci logout
```

## Diagnose

When a pipeline fails, get AI-powered diagnosis:

```bash
pushci diagnose
```

Runs all checks, sends failures to Claude AI, and returns an explanation
with a suggested fix for each failing step. Requires either
`ANTHROPIC_API_KEY` or a Pro plan login.

## Heal

Let AI auto-fix your broken pipeline:

```bash
pushci heal
```

Detects failures and applies patches directly to source files when
possible. Reports which issues were fixed automatically and which
need manual attention.

## Generate

AI-generate an optimized `pushci.yml` from scratch:

```bash
pushci generate
```

Detects your stack and asks Claude AI to produce a complete pipeline
config. Overwrites any existing `pushci.yml`.

## Migrate

Convert an existing GitHub Actions workflow to PushCI format:

```bash
pushci migrate .github/workflows/ci.yml
pushci migrate .github/workflows/ci.yml --write
```

Without `--write`, the converted YAML is printed to stdout.
With `--write`, it is saved to `pushci.yml` in the project root.

## Docker Runner (Cross-Platform)

Running on Windows but deploying to Linux? Use Docker mode:

```yaml
# pushci.yml
stages:
  - name: test
    checks:
      - name: unit-tests
        run: npm test
        docker: node:20-slim
```

PushCI auto-selects the right Docker image for your stack when
the host OS differs from the deploy target. Supports `--platform`
for cross-architecture builds (e.g. `linux/amd64` on ARM Mac).

## Next Steps

- [CLI Reference](CLI.md) -- full command reference with flags and examples
- [VS GitHub Actions](VS_GITHUB_ACTIONS.md) -- migration guide
- [VS GitLab CI](VS_GITLAB_CI.md) / [VS CircleCI](VS_CIRCLECI.md)
- [pushci.dev](https://pushci.dev) / [GitHub](https://github.com/finsavvyai/pushci)
