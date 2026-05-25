# PushCI: I Built a Free CI/CD Tool That Replaces GitHub Actions in 30 Seconds

*Zero YAML. Zero cost. AI auto-detects your stack.*

---

## The Problem

Every developer knows this pain:

1. Start a new project
2. Write code for 2 hours
3. Spend 45 minutes writing a `.github/workflows/ci.yml`
4. Debug the YAML for another 30 minutes
5. Push. Wait. Fail. Fix. Wait. Repeat.

GitHub Actions charges $0.008/min. For a team doing 1,000 runs/month at 8 minutes each, that's **$768/year** to run `npm test`.

## The Solution: PushCI

```bash
npx pushci init
```

That's it. PushCI uses AI to:
- Detect your languages, frameworks, and test suites
- Generate a complete CI/CD pipeline
- Install a git pre-push hook
- Run everything locally for **$0**

### What It Supports

- **19 languages**: Go, Node/TypeScript, Python, Rust, Java, C#, Ruby, PHP, Swift, Dart, Elixir, Zig, and more
- **40+ frameworks**: Next.js, Django, Spring Boot, Rails, Laravel, SvelteKit, FastAPI, and more
- **16 deploy targets**: AWS, GCP, Azure, Cloudflare, Vercel, Netlify, Fly.io, Docker, K8s
- **3 git platforms**: GitHub, GitLab, AND Bitbucket

### How It Compares

| Feature | PushCI | GitHub Actions | GitLab CI | Jenkins |
|---------|--------|---------------|-----------|---------|
| Setup | 30 sec | 30+ min | 30+ min | Hours |
| Config | AI auto | YAML | YAML | Groovy |
| Cost | Free | $0.008/min | $0.008/min | Server costs |
| AI built-in | Yes | No | No | No |
| Local runs | Yes | No | Limited | No |
| Multi-platform | GH+GL+BB | GitHub only | GitLab only | All |

## AI Agent Integration (MCP Server)

PushCI includes an MCP server that works with Claude Code, Cursor, Windsurf, and Cline:

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

Tell your AI agent "set up CI for this project" and it does the rest.

## Self-Healing Pipelines

When your pipeline breaks, PushCI auto-diagnoses and fixes it:

```bash
pushci heal
```

It detects 26+ failure patterns (missing deps, flaky tests, format errors, timeouts) and applies patches automatically.

## Try It

```bash
npx pushci init    # Auto-detect and generate pipeline
pushci run         # Run CI locally
pushci heal        # Auto-fix broken pipelines
pushci ask "deploy to staging"  # Natural language commands
```

**Website**: [pushci.dev](https://pushci.dev)
**GitHub**: [finsavvyai/pushci](https://github.com/finsavvyai/pushci)
**npm**: `npx pushci init`
**Compare**: [PushCI vs GitHub Actions](https://pushci.dev/vs/github-actions)
**Cost Calculator**: [See how much you save](https://pushci.dev/tools/cost-calculator)

---

*Tags: cicd, devops, githubactions, ai*
