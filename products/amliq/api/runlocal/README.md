# PushCI

**Zero-config AI CI/CD. Runs on your machine. Free forever.**

```bash
npx pushci init    # AI detects your stack
git push             # tests run automatically
```

## Why PushCI?

| | PushCI | GitHub Actions | GitLab CI |
|--|---------|---------------|-----------|
| **Setup** | Zero config | 50+ lines YAML | 50+ lines YAML |
| **Cost** | $0 (your machine) | $0.008/min | $0.008/min |
| **Platforms** | GitHub + GitLab + Bitbucket | GitHub only | GitLab only |
| **AI** | Auto-detects stack | None | None |

## Quick Start

```bash
# Install
npx pushci init

# Run CI locally
pushci run

# Start webhook agent
GITHUB_TOKEN=xxx pushci agent
```

## Supported

**12 Languages**: Go, Node/TS, Python, Rust, Java, C#,
Ruby, PHP, Swift, Dart, Elixir, Docker

**Build Tools**: Maven, Gradle, npm, pnpm, Yarn, pip,
Poetry, Cargo, dotnet, Bundler, Composer, Mix

**Frameworks**: Next.js, Nuxt, SvelteKit, Django, FastAPI,
Flask, Spring Boot, Rails, Laravel, Phoenix, Flutter +more

**16 Deploy Targets**: Cloudflare, AWS (ECS/Lambda/S3),
GCP (Cloud Run/App Engine), Azure, Vercel, Railway,
Fly.io, Netlify, Docker, Kubernetes, SSH

## Configuration

Optional `pushci.yml`:

```yaml
on: [push, pull_request]
checks:
  - build
  - test
  - lint
  - line-limit: 100
deploy:
  target: cloudflare-pages
  trigger: merge to main
```

Or just run `pushci init` — it figures everything out.

## Commands

```
pushci init      Scan repo, generate config, install hooks
pushci run       Run full CI pipeline
pushci agent     Start webhook server (GitHub/GitLab/BB)
pushci status    Show last run results
pushci version   Print version
```

## Pricing

| Free | Pro $9/mo | Team $29/mo |
|------|-----------|-------------|
| 1 repo | Unlimited | Unlimited |
| Self-hosted | Dashboard | Shared runners |
| Unlimited runs | Slack/Discord | SSO + audit |

## License

MIT
