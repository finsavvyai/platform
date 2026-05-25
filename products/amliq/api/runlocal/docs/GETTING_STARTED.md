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

## Doctor

Verify your environment is ready:

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

## Next Steps

- [VS GitHub Actions](VS_GITHUB_ACTIONS.md) -- migration guide
- [VS GitLab CI](VS_GITLAB_CI.md) / [VS CircleCI](VS_CIRCLECI.md)
- [pushci.dev](https://pushci.dev) / [GitHub](https://github.com/finsavvyai/pushci)
