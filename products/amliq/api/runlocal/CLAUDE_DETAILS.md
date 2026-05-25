# CLAUDE_DETAILS.md — PushCI Extended Reference

## Go Packages (21)

| Package | Purpose |
|---------|---------|
| ai | Claude API: diagnosis, pipeline gen, converter |
| artifacts | Build artifact tracking + bloat detection |
| autofix | Auto-fix PRs (branch, commit, push, PR) |
| cli | Colored ANSI output, spinners, tables |
| cloud | Runner pool, Hetzner/Fly, job queue, scheduler |
| config | pushci.yml YAML parser |
| debug | CI replay, snapshots, step-by-step breakpoints |
| deploy | 21 targets: AWS, GCP, Azure, CF, Terraform, K8s |
| detect | 19 languages, 40+ frameworks, build tools |
| heal | Self-healing: 7 strategies + AI Claude fallback |
| intel | Change detection, test caching, parallel, diagnosis |
| mcp | MCP server (5 tools for AI agents) |
| middleware | Rate limit, JSON logging, panic recovery, CORS |
| nlp | Natural language interpreter + action executors |
| notify | Slack, Discord, email notifications |
| pipeline | Auto-update pushci.yml when repo changes |
| platform | GitHub, GitLab, Bitbucket webhook + status API |
| plugin | Registry, script, docker, builtin plugins |
| runner | Check execution, parallel, summary formatting |
| secrets | AES-256-GCM encrypted env var store |
| server | Webhook HTTP server, job dispatch |

## CLI Commands (14)

```
pushci init           # detect stack, generate config
pushci run            # run CI (--heal --parallel --all)
pushci agent          # webhook server on :9876
pushci doctor         # check git/go/node/docker/hooks
pushci secret set/get/list/delete
pushci mcp            # MCP server for AI agents
pushci heal           # fix failures (--commit --pr)
pushci ask "..."      # natural language (or REPL)
pushci debug          # step-by-step (--replay --break-after)
pushci status         # last run results
pushci version        # v1.0.1
```

## Key Design Documents

| Doc | Content |
|-----|---------|
| ROADMAP.md | 6-phase roadmap: v0.3→v2.0 |
| VISION.md | Product mission + architecture |
| VISION_PHASES.md | 5 phases: tool→team→AI→enterprise→platform |
| VISION_TECHNICAL.md | Data model, security, pricing architecture |
| VISION_GTM.md | 3-wave launch, personas, viral loops |
| docs/SCHEMA.md | 17 PostgreSQL tables (full DDL) |
| docs/API_SPEC.md | All REST endpoints + auth + pagination |
| docs/RUNNER_PROTOCOL.md | Registration, heartbeat, job lifecycle |
| docs/WORKFLOW_SPEC.md | Full YAML syntax + 5 examples |
| docs/SECURITY_MODEL.md | Threat model + 9 mitigations |
| docs/SECURITY_AUDIT.md | Audit report: 8 issues found, all fixed |
| docs/PRODUCT_SPEC.md | Full SaaS product specification |
| docs/INSTALL.md | 6 installation methods |

## Launch Assets (docs/launch/)

| File | Purpose |
|------|---------|
| PRODUCT_HUNT.md | Tagline, description, maker comment |
| TWITTER_THREAD.md | 10-tweet launch thread |
| BLOG_POST.md | "How I Built a GitHub Actions Replacement" |
| EMAIL_TEMPLATES.md | Outreach: indie, CTO, OSS maintainer |
| LANDING_COPY.md | Conversion-optimized copy + FAQ |
| COMMUNITIES.md | 15+ channels with posting guides |

## How to Deploy

```bash
# 1. Build
go build -o pushci ./cmd/pushci
make build-landing build-dashboard

# 2. Deploy
./deploy-cloudflare.sh

# 3. Set secrets
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put GITHUB_CLIENT_SECRET

# 4. npm publish
npm publish

# 5. Make commands
make build test deploy dev-landing dev-dashboard release
```

## Code Rules

- Every file ≤100 lines (split if approaching)
- Go tests: table-driven `[]struct{...}` pattern
- React: functional components, hooks, Tailwind only
- Dark theme: zinc-950 bg, emerald-500 accent
- No external UI libs (no shadcn, no MUI)
- No mocks in production code (sample data labeled clearly)
- Secrets via env vars only, never hardcoded
- Claude API: use system param, anthropic-version header
- Module path: github.com/finsavvyai/pushci

## Competitors

| Tool | Our Advantage |
|------|--------------|
| GitHub Actions | Zero config, $0 compute, multi-platform |
| GitLab CI | Works on GitHub+Bitbucket too |
| CircleCI | 95% margins vs 40%, AI-native |
| Jenkins | Modern UX, zero setup |
| Woodpecker CI | AI features, cloud runners |
| Dagger | No new language to learn |
| Depot | Broader scope (not just Docker) |
