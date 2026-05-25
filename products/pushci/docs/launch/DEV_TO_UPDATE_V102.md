# PushCI v1.0.2: We Shipped Local Releases Because Paying to Run `go build` on Someone Else's Computer Was Getting Embarrassing

*Your machine can compile code. You don't need to rent one.*

---

## The Moment That Broke Me

I tagged a release. Six GitHub Actions matrix builds kicked off. Fifteen minutes later I had six binaries, a GitHub Release, and a Homebrew formula update.

Cost: $0.96.

For `go build`. Six times. On a computer in Virginia.

My M3 MacBook was sitting right there. Doing nothing. It could've done the whole thing in 47 seconds. But instead, I'm paying Microsoft per minute to compress files and upload them to a website I own.

So I built `pushci release`.

## What's New in v1.0.2

### `pushci release` — Build & Publish From Your Machine ($0)

```bash
git tag v1.2.0
pushci release
```

That's it. PushCI wraps GoReleaser to:

- **Cross-compile** for 6 platforms (Linux, macOS, Windows x amd64/arm64)
- **Create a GitHub Release** with all binaries and checksums
- **Push your Homebrew formula** to your tap repo automatically
- **Publish to npm** if configured

All from your local machine. In under a minute. For $0.

### The Cost Math

| | GitHub Actions | CircleCI | PushCI |
|--|---------------|----------|--------|
| Per release | $0.72–$0.96 | $0.90 | **$0** |
| Weekly releases | $37–50/yr | $47/yr | **$0** |
| Daily releases | $262–350/yr | $328/yr | **$0** |

You're paying someone to run `go build` on their computer while your computer sits there, fully capable, watching.

### Dry Run Mode

Not ready to publish? Preview what would happen:

```bash
pushci release --dry-run
```

Builds everything locally, shows you the summary, publishes nothing.

## Also New: `pushci troubleshoot`

When something breaks, you used to get "Error: exit code 1" and a link to a log file. Now:

```bash
pushci troubleshoot
```

Checks five areas with actionable fixes:

```
Environment
  ✓ Git installed
  ✓ Go installed
  ✓ Node.js installed
  ⚠ ANTHROPIC_API_KEY not set (AI features disabled)
    Fix: export ANTHROPIC_API_KEY=sk-ant-...
Configuration
  ✓ pushci.yml found
Git Hook
  ✓ pre-push hook installed
```

Every issue tells you exactly what command to run.

## Also New: Docker Cross-Platform Runner

Windows user deploying to Linux? PushCI now auto-detects the mismatch and runs your pipeline inside Docker:

```yaml
stages:
  - name: test
    checks:
      - name: unit-tests
        run: npm test
        docker: node:20-slim
```

Auto-selects the right image for your stack. Supports `--platform` for cross-architecture builds.

## Also New: Homebrew Support

```bash
brew install finsavvyai/tap/pushci
```

Six install methods now: npm, Homebrew, Go, curl, Docker, npx.

## 34 Files Refactored to ≤100 Lines

We enforce a 100-line max per source file. We had 34 files over the limit. Now we have zero. Every Go file in the project is under 100 lines.

This is what happens when you actually eat your own dog food.

## The Full Picture

PushCI v1.0.2:
- **20 CLI commands** including release, troubleshoot, diagnose, heal
- **19 languages**, 40+ frameworks, 16 deploy targets
- **69 marketplace skills**
- **Docker runner** for cross-platform CI
- **6 install methods**: npm, Homebrew, Go, curl, Docker, npx
- **MCP server** for Claude Code, Cursor, Windsurf, Cline
- **$0 forever** — your machine, your builds, your releases

## Try It

```bash
# Install
npm install -g pushci

# Set up CI
pushci init

# Run locally
pushci run

# Release from your machine
git tag v1.0.0 && pushci release

# Diagnose issues
pushci troubleshoot
```

**Website**: [pushci.dev](https://pushci.dev)
**Release Feature**: [pushci.dev/release](https://pushci.dev/release)
**GitHub**: [github.com/finsavvyai/pushci](https://github.com/finsavvyai/pushci)
**Homebrew**: `brew install finsavvyai/tap/pushci`
**npm**: `npm install -g pushci`

---

*So let me get this straight. You were paying per minute. To run a compiler. On a rented computer. While your own computer — which you already paid for — was sitting right there. And nobody said anything?*

*pushci.dev*

---

*Tags: cicd, devops, opensource, productivity*
