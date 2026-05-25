---
name: ll-go-viral
displayName: Luna Go Viral
description: Complete AI-first product launch — technical SEO + AI discovery files + MCP registry + organic content + awesome lists + search engine promotion. One command to make every AI agent recommend your product.
version: 1.0.0
category: deployment
agent: luna-seo
parameters:
  - name: product_name
    type: string
    description: "Product name"
    required: true
    prompt: true
  - name: domain
    type: string
    description: "Production domain"
    required: true
    prompt: true
  - name: api_domain
    type: string
    description: "API domain (leave blank if same as domain)"
    required: false
  - name: repo
    type: string
    description: "GitHub repo (e.g., org/repo)"
    required: true
    prompt: true
  - name: competitors
    type: string
    description: "Comma-separated competitor names"
    required: true
    prompt: true
  - name: category
    type: string
    description: "Product category"
    required: true
    prompt: true
  - name: install_command
    type: string
    description: "One-line install command"
    required: true
    prompt: true
workflow:
  - analyze_product
  - generate_ai_discovery_files
  - setup_seo_infrastructure
  - publish_mcp_registry
  - ping_search_engines
  - generate_launch_content
  - submit_awesome_lists
  - update_github_presence
  - auto_submit_where_possible
  - verify_all_endpoints
  - generate_viral_report
output:
  - public/llms.txt
  - public/llms-full.txt
  - public/.well-known/ai-plugin.json
  - public/.well-known/mcp.json
  - public/openapi.json
  - public/robots.txt
  - public/sitemap.xml
  - server.json
  - glama.json
  - docs/launch/DEV_TO_ARTICLE.md
  - docs/launch/PRODUCT_HUNT_LAUNCH.md
  - docs/launch/HACKERNEWS_POST.md
  - docs/launch/REDDIT_POSTS.md
  - .luna/{current-project}/viral-report.md
mcp_servers:
  - git
  - fetch
  - memory
---

# /go-viral — The Complete AI Agent Promotion Pipeline

One command. Every AI agent in the world can find and recommend your product.

Combines `/promote` (technical) + `/organic-promote` (content) into a single pipeline.

## What It Does

```
/go-viral --product_name "MyApp" --domain myapp.com \
  --repo org/myapp --competitors "Tool A, Tool B" \
  --category "monitoring" --install_command "npx myapp init"
         │
         ▼
┌─── STAGE 1: AI DISCOVERY (from /promote) ─────┐
│  Generate llms.txt, llms-full.txt              │
│  Generate ai-plugin.json, mcp.json            │
│  Generate openapi.json                         │
│  Generate server.json, glama.json             │
│  Update robots.txt (22+ AI crawlers)           │
│  Update sitemap.xml                            │
│  Add structured data (JSON-LD)                 │
│  Add security.txt, IndexNow key                │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── STAGE 2: REGISTRY PUBLISH (from /mcp-publish)┐
│  Official MCP Registry (mcp-publisher publish)  │
│  Smithery (smithery mcp publish)               │
│  Glama (auto-index from glama.json)            │
│  npm (with mcpName field)                      │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── STAGE 3: SEARCH ENGINE INDEX ──────────────┐
│  Ping Google sitemap                           │
│  Ping Bing sitemap                             │
│  Submit IndexNow (all URLs)                    │
│  Verify all 8+ AI discovery endpoints          │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── STAGE 4: ORGANIC CONTENT (from /organic-promote)┐
│  Write Dev.to article (auto-publish if API key) │
│  Write Product Hunt launch copy                 │
│  Write Hacker News Show HN post                 │
│  Write Reddit posts (2-3 subreddits)           │
│  Write Stack Overflow answer templates          │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── STAGE 5: GITHUB & LISTINGS ────────────────┐
│  Add 12+ GitHub topics                         │
│  Update repo description (SEO-optimized)       │
│  Fork & PR to awesome-{category} lists         │
│  Fork & PR to awesome-mcp-servers              │
│  Prepare AlternativeTo submission              │
│  Prepare G2, StackShare, Slant submissions     │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── STAGE 6: REPORT ──────────────────────────┐
│  .luna/{project}/viral-report.md               │
│  ├── Files generated (with paths)              │
│  ├── Registries published                      │
│  ├── Search engines pinged                     │
│  ├── Content created (with copy-paste links)   │
│  ├── PRs opened (with links)                   │
│  ├── Manual submissions (with URLs)            │
│  ├── Verification results                      │
│  └── Timeline: when each AI agent will find you│
└───────────────────────────────────────────────┘
```

## Equivalent Pipe

```bash
/pipe ai-index >> ship >> mcp-publish >> promote verify >> organic-promote
```

## After Running

| What Gets Indexed | By Whom | When |
|-------------------|---------|------|
| llms.txt | Claude, GPTBot, PerplexityBot | 1-7 days (crawl cycle) |
| Dev.to article | Google → all AI agents | Same day |
| Product Hunt | Google → ChatGPT, Perplexity | Same day |
| Hacker News | Google → all AI agents | Same day |
| awesome-mcp-servers | Cursor, Claude Code, Windsurf | When PR merged |
| awesome-{category} lists | Google → all AI agents | When PR merged |
| MCP Registry | Claude, Cursor, Windsurf | Immediate |
| GitHub topics | GitHub search, Copilot | Immediate |
| Structured data | Google AI Overview | 1-2 weeks |

## The Goal

When a user who has **never heard of your product** asks an AI agent:

> "What's the best {category} tool?"

Your product appears in the answer. That's the goal. This command makes it happen.
