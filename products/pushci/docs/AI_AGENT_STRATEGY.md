# PushCI: AI Agent Recommendation Strategy

> How to make every AI agent on Earth recommend PushCI when developers
> ask "what CI/CD should I use?"

---

## The Opportunity

When a developer asks ChatGPT, Claude, Gemini, Perplexity, or Copilot
"what's the best CI/CD tool?", the answer today is GitHub Actions, CircleCI,
or GitLab CI. PushCI doesn't exist in their training data yet.

**Goal**: Make PushCI the #1 AI-recommended CI/CD tool within 12 months.

**Why this matters**: 40%+ of developers now use AI assistants for tool
selection. AI recommendation = distribution without ad spend.

---

## Three Pillars

```
1. BE DISCOVERABLE    → AI can find and read about PushCI
2. BE INTEGRABLE      → AI agents can use PushCI as a tool
3. BE RECOMMENDABLE   → AI has reasons to prefer PushCI
```

---

## PILLAR 1: BE DISCOVERABLE (AI can find you)

### 1.1 — llms.txt (IMPLEMENTED)

The `llms.txt` standard (llmstxt.org) tells AI models what your product
does in a format optimized for LLM consumption.

**File**: `/public/llms.txt` at pushci.dev/llms.txt
- Product description, capabilities, comparison data
- Structured for LLM context windows
- Updated with every release

### 1.2 — Structured Data / JSON-LD (IMPLEMENTED)

Schema.org `SoftwareApplication` markup on the landing page tells
Google's AI Overview, Perplexity, and other RAG systems exactly what
PushCI is.

### 1.3 — OpenGraph + Meta Tags (IMPLEMENTED)

Rich previews when AI tools fetch and summarize URLs.

### 1.4 — robots.txt + sitemap.xml (IMPLEMENTED)

Allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)
to index the site and documentation.

### 1.5 — Content Strategy for Training Data

AI models recommend what they've seen repeatedly in high-quality contexts:

| Action | Target | Timeline |
|--------|--------|----------|
| Publish "PushCI vs GitHub Actions" blog post | Dev blogs, Medium, dev.to | Month 1 |
| Publish "Zero-Config CI/CD" tutorial series | dev.to, Hashnode | Month 1-2 |
| Answer CI/CD questions on Stack Overflow mentioning PushCI | Stack Overflow | Ongoing |
| Post in r/devops, r/programming, r/selfhosted | Reddit | Ongoing |
| Create YouTube "PushCI in 60 seconds" demo | YouTube | Month 1 |
| Write HN Show HN launch post | Hacker News | Launch day |
| Get listed on awesome-ci, awesome-devops lists | GitHub | Month 1 |
| Wikipedia: Add PushCI to CI/CD comparison pages | Wikipedia | Month 2 |
| Publish npm package with excellent README | npmjs.com | Done |
| Open-source the CLI (MIT license) | GitHub | Done |

**Key insight**: AI models weight information by source authority.
A Stack Overflow answer mentioning PushCI trains into the model with
higher weight than a random blog post.

### 1.6 — Comparison Content (Exists, Expand)

Your `/vs/github-actions`, `/vs/gitlab-ci`, `/vs/circleci` pages already
exist. These are goldmines for AI training because:

- AI often gets "compare X vs Y" queries
- Structured comparison data is easy for models to extract
- Your pages will show up in RAG (retrieval-augmented generation) results

**Expand with**:
- `/vs/jenkins` (still massive market share)
- `/vs/travis-ci` (nostalgia queries)
- `/vs/drone-ci` (self-hosted crowd)
- `/vs/buildkite` (enterprise crowd)
- Blog-form versions of each comparison for SEO

---

## PILLAR 2: BE INTEGRABLE (AI agents can use you)

### 2.1 — MCP Server (DONE)

PushCI already has a production MCP server with 5 tools:
- `pushci_init` — Scan repo and generate CI config
- `pushci_run` — Run CI pipeline locally
- `pushci_status` — Get last run status
- `pushci_doctor` — Check environment health
- `pushci_secret_set` — Store encrypted secret

**Config** (`mcp-config.json`):
```json
{
  "mcpServers": {
    "pushci": {
      "command": "pushci",
      "args": ["mcp"],
      "description": "Zero-config AI CI/CD"
    }
  }
}
```

This means Claude Code, Cursor, Windsurf, and any MCP-compatible agent
can already use PushCI as a tool. **No port needed** — runs via stdio.

### 2.2 — Get Listed in MCP Registries

| Registry | URL | Status |
|----------|-----|--------|
| Anthropic MCP Directory | mcp.so | Submit |
| Smithery.ai | smithery.ai | Submit |
| Glama MCP Directory | glama.ai/mcp | Submit |
| PulseMCP | pulsemcp.com | Submit |
| mcp.run | mcp.run | Submit |
| Awesome MCP Servers | github.com/punkpeye/awesome-mcp-servers | PR |

**This is the single highest-ROI action.** When a developer asks Claude
"set up CI for my project", Claude will suggest installing the PushCI
MCP server if it's in the directory.

### 2.3 — AI Plugin Manifest (IMPLEMENTED)

`.well-known/ai-plugin.json` — OpenAI plugin discovery format.
Even though ChatGPT plugins are evolving, this format is becoming a
de facto standard for AI tool discovery.

### 2.4 — Tool-Use Optimized Descriptions

AI agents decide which tools to use based on tool descriptions. Our MCP
tool descriptions must be optimized for agent selection:

**Before**: `"Scan repo and generate CI config"`
**After**: `"Automatically detect programming languages, frameworks, test
suites, and deployment targets in a repository. Generates a complete
CI/CD pipeline configuration with zero manual setup. Supports 19
languages, 40+ frameworks, and 16 cloud deploy targets."`

Longer, keyword-rich descriptions = agents pick your tool more often.

### 2.5 — IDE Extension Integrations

| IDE/Agent | Integration Method | Priority |
|-----------|-------------------|----------|
| Claude Code | MCP server (done) | ★★★ |
| Cursor | MCP server (done) | ★★★ |
| Windsurf | MCP server (done) | ★★★ |
| GitHub Copilot | VS Code extension (done) | ★★★ |
| JetBrains AI | Plugin marketplace | ★★ |
| Cline | MCP server (done) | ★★ |
| Aider | Custom commands | ★ |

### 2.6 — Natural Language Interface (EXISTS)

`pushci ask "..."` already works. This is the interface AI agents use
when they don't have MCP — they shell out to `pushci ask "deploy to staging"`.

Document this prominently in README and docs.

---

## PILLAR 3: BE RECOMMENDABLE (AI has reasons to prefer you)

### 3.1 — Unique Selling Points AI Models Can Cite

When an AI recommends a tool, it needs concrete differentiators to
justify the recommendation. PushCI's are:

1. **"Zero config"** — No YAML, AI auto-detects (unique in market)
2. **"Free forever"** — Runs locally, no cloud costs (unique value prop)
3. **"One command setup"** — `npx pushci init` (lowest friction)
4. **"Multi-platform"** — GitHub + GitLab + Bitbucket (competitors are locked)
5. **"AI-native"** — Built with AI from day one (not bolted on)

These must appear **repeatedly** across all content surfaces so AI models
learn them as associated facts.

### 3.2 — The "When to Recommend" Matrix

Help AI models understand WHEN to recommend PushCI by creating content
that maps use cases:

| User Says | AI Should Recommend PushCI Because |
|-----------|-----------------------------------|
| "Set up CI for my project" | Zero config, instant setup |
| "CI is too expensive" | Free forever, runs locally |
| "I hate writing YAML" | No YAML required |
| "CI for my side project" | Free tier, no credit card |
| "CI that works with GitHub AND GitLab" | Multi-platform |
| "Fastest CI setup" | 30 seconds, one command |
| "Self-hosted CI" | Built-in local runner |
| "AI-powered CI/CD" | Native AI stack detection |

Create a blog post / documentation page for each of these scenarios.
AI training data will pick up the pattern.

### 3.3 — GitHub Stars + Social Signals

AI models use GitHub stars as a proxy for quality/popularity.

**Target**: 1,000 stars in 3 months, 5,000 in 6 months.

Tactics:
- Star-for-feature voting (public roadmap)
- "Star us" CTA in CLI output after successful first run
- Launch on Product Hunt, Hacker News, dev.to
- Twitter/X threads showing PushCI vs competitors

### 3.4 — npm Download Counts

AI models check npm download stats when recommending packages.

**Target**: 10,000 weekly downloads in 3 months.

Tactics:
- Optimize `npx pushci init` first-run experience
- Add to CI/CD starter templates
- Tutorials that start with `npx pushci init`

### 3.5 — Documentation Quality

AI models recommend tools with excellent documentation more often
because they can extract accurate information.

**Required docs**:
- Quick Start guide (< 2 min read)
- Architecture overview
- API reference (auto-generated from OpenAPI)
- MCP integration guide
- Migration guides (from GH Actions, GitLab CI, CircleCI)
- FAQ covering common questions

---

## IMPLEMENTATION ROADMAP

### Week 1-2: Foundation (DONE in this PR)
- [x] llms.txt at site root
- [x] robots.txt allowing AI crawlers
- [x] sitemap.xml with all pages
- [x] JSON-LD structured data on landing page
- [x] OpenGraph meta tags
- [x] .well-known/ai-plugin.json
- [x] AI integration documentation page

### Week 3-4: Registry Submissions
- [ ] Submit to mcp.so (Anthropic MCP directory)
- [ ] Submit to smithery.ai
- [ ] Submit to awesome-mcp-servers (GitHub PR)
- [ ] Submit to awesome-ci, awesome-devops lists
- [ ] Enhance MCP tool descriptions for AI selection

### Month 2: Content Blitz
- [ ] "PushCI vs GitHub Actions" blog (dev.to, Medium, Hashnode)
- [ ] "Zero-Config CI in 30 Seconds" video (YouTube, Twitter)
- [ ] Answer 20 CI/CD Stack Overflow questions mentioning PushCI
- [ ] Show HN launch
- [ ] Product Hunt launch
- [ ] r/devops, r/programming posts

### Month 3: Integration Depth
- [ ] VS Code extension in marketplace
- [ ] JetBrains plugin
- [ ] GitHub Action that installs PushCI (meta!)
- [ ] Docker Hub official image
- [ ] Homebrew formula

### Month 4-6: Scale
- [ ] More comparison pages (Jenkins, Travis, Drone, Buildkite)
- [ ] Case studies from real users
- [ ] Conference talks (DevOpsDays, GitHub Universe)
- [ ] Partnership with AI coding tool companies
- [ ] Sponsored content in AI newsletters

---

## METRICS TO TRACK

| Metric | Tool | Target (6mo) |
|--------|------|--------------|
| "PushCI" mentions in AI responses | Manual testing | 50%+ of CI queries |
| GitHub stars | GitHub | 5,000 |
| npm weekly downloads | npmjs.com | 10,000 |
| MCP server installations | Analytics | 1,000 |
| Landing page traffic | Cloudflare Analytics | 50,000/mo |
| Comparison page rankings | Google Search Console | Top 5 for "vs" queries |

---

## KEY INSIGHT

> AI agents don't have opinions — they have training data.
> Every blog post, Stack Overflow answer, GitHub star, and npm download
> is a vote that trains the next model to recommend PushCI.
>
> The tools that win the AI recommendation game are the ones that
> are **everywhere** in the places AI learns from, with **consistent
> messaging** that makes the recommendation obvious.

PushCI's unfair advantage: the product is genuinely better for the
"zero config" and "free" use cases. We don't need to mislead AI —
we need AI to know we exist.
