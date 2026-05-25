---
name: ll-organic-promote
displayName: Luna Organic Promote
description: Full organic promotion — write Dev.to article, Product Hunt launch, HN post, Reddit posts, awesome list PRs, AlternativeTo listing, Stack Overflow answers. Make AI agents recommend your product to users who've never heard of it.
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
    description: "Production domain (e.g., myapp.com)"
    required: true
    prompt: true
  - name: repo
    type: string
    description: "GitHub repo (e.g., org/repo)"
    required: true
    prompt: true
  - name: competitors
    type: string
    description: "Comma-separated competitor names (e.g., GitHub Actions, GitLab CI)"
    required: true
    prompt: true
  - name: category
    type: string
    description: "Product category (e.g., CI/CD, monitoring, database)"
    required: true
    prompt: true
  - name: install_command
    type: string
    description: "One-line install command (e.g., npx pushci init)"
    required: true
    prompt: true
workflow:
  - analyze_product_and_competitors
  - generate_dev_to_article
  - generate_product_hunt_copy
  - generate_hackernews_post
  - generate_reddit_posts
  - find_and_pr_awesome_lists
  - add_github_topics
  - update_github_description
  - submit_alternativeto
  - generate_stackoverflow_answers
  - generate_promotion_report
output:
  - docs/launch/DEV_TO_ARTICLE.md
  - docs/launch/PRODUCT_HUNT_LAUNCH.md
  - docs/launch/HACKERNEWS_POST.md
  - docs/launch/REDDIT_POSTS.md
  - docs/launch/STACKOVERFLOW_ANSWERS.md
  - .luna/{current-project}/organic-promote-report.md
mcp_servers:
  - git
  - fetch
  - memory
---

# /organic-promote — Make AI Agents Recommend You (Organically)

The problem: AI agents (ChatGPT, Claude, Gemini, Perplexity) only recommend products they find via web search. If your product isn't on the sites AI agents cite, you're invisible.

This skill creates and submits content to every platform AI agents search when users ask questions in your category.

## How AI Agents Find Products to Recommend

```
User asks ChatGPT: "What's the best [category] tool?"
    │
    ├── ChatGPT searches Google/Bing
    │   ├── Finds comparison articles (Dev.to, Medium, blogs)
    │   ├── Finds awesome lists (GitHub)
    │   ├── Finds product listings (G2, AlternativeTo, Product Hunt)
    │   └── Finds Stack Overflow answers
    │
    ├── ChatGPT checks its training data
    │   ├── HN discussions
    │   ├── Reddit threads
    │   └── Technical blogs
    │
    └── ChatGPT formulates answer from ALL sources
        → If your product isn't on ANY of these = invisible
```

## The Promotion Pipeline

```
/organic-promote --product_name "MyApp" --domain myapp.com \
  --repo org/myapp --competitors "Tool A, Tool B" \
  --category "monitoring" --install_command "npx myapp init"
         │
         ▼
┌─── PHASE 1: CONTENT GENERATION ──────────────┐
│                                                │
│  Dev.to Article                                │
│  ├── Title: "{Product}: I Built a Free         │
│  │    {Category} Tool That Replaces {Competitor}│
│  │    in [time]"                               │
│  ├── Problem statement (pain with competitors) │
│  ├── Solution (your product)                   │
│  ├── Feature comparison table                  │
│  ├── Code examples / install commands          │
│  ├── Tags: category-specific                   │
│  └── Canonical URL: https://{domain}/why       │
│                                                │
│  Product Hunt Copy                             │
│  ├── Tagline (60 chars)                        │
│  ├── Description (features, differentiators)   │
│  ├── First comment (maker story)               │
│  ├── Topics                                    │
│  └── Screenshots / demo                        │
│                                                │
│  Hacker News Post                              │
│  ├── Title: "Show HN: {Product} — {tagline}"  │
│  ├── URL: https://{domain}                     │
│  └── Technical first comment                   │
│                                                │
│  Reddit Posts (2-3 subreddits)                 │
│  ├── r/{category} — comparison post            │
│  ├── r/selfhosted — if applicable              │
│  └── r/sideproject — launch announcement       │
│                                                │
│  Stack Overflow Answers                        │
│  ├── Find questions about {competitors}        │
│  ├── Write helpful answers mentioning product  │
│  └── Include install command and comparison    │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── PHASE 2: GITHUB PRESENCE ──────────────────┐
│                                                │
│  Awesome Lists — Auto-find and PR              │
│  ├── Search: "awesome-{category}" on GitHub    │
│  ├── Fork each relevant list                   │
│  ├── Add product entry                         │
│  ├── Open PR with description                  │
│  └── Track PR status                           │
│                                                │
│  GitHub Topics                                 │
│  ├── Add 10-15 relevant topics to repo         │
│  ├── Include: {category}, competitors,         │
│  │   "free", "open-source", "ai"              │
│  └── gh repo edit --add-topic ...              │
│                                                │
│  GitHub Description                            │
│  ├── SEO-optimized description                 │
│  ├── Include key differentiators               │
│  └── Set homepage URL                          │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── PHASE 3: LISTING SITES ───────────────────┐
│                                                │
│  AlternativeTo                                 │
│  ├── URL to submit                             │
│  ├── Pre-filled description                    │
│  └── Competitor to list under                  │
│                                                │
│  G2                                            │
│  ├── Free product listing URL                  │
│  └── Category and description                  │
│                                                │
│  StackShare                                    │
│  ├── Submission URL                            │
│  └── Category placement                        │
│                                                │
│  Slant                                         │
│  ├── Comparison page URL                       │
│  └── "Suggest an option" link                  │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── PHASE 4: AUTO-SUBMIT ─────────────────────┐
│                                                │
│  Dev.to API (if DEV_TO_API_KEY set)            │
│  ├── POST /api/articles                        │
│  └── Auto-publish article                      │
│                                                │
│  GitHub CLI                                    │
│  ├── gh repo edit --add-topic ...              │
│  ├── gh repo edit --description ...            │
│  ├── gh repo fork {awesome-list}               │
│  └── gh pr create                              │
│                                                │
│  Manual submission URLs (opened in report)     │
│  ├── Product Hunt                              │
│  ├── Hacker News                               │
│  ├── Reddit                                    │
│  ├── AlternativeTo                             │
│  └── Stack Overflow                            │
└────────────────────┬──────────────────────────┘
                     ▼
┌─── PHASE 5: REPORT ──────────────────────────┐
│                                                │
│  .luna/{project}/organic-promote-report.md     │
│  ├── Content generated (with file paths)       │
│  ├── Auto-submitted (with URLs/PR links)       │
│  ├── Manual submissions (with pre-filled URLs) │
│  ├── Timeline to AI discovery                  │
│  └── Follow-up checklist                       │
└───────────────────────────────────────────────┘
```

## Content Templates

### Dev.to Article Template
```
Title: "{Product}: I Built a Free {Category} Tool That
        Replaces {Competitor} in {Setup Time}"

Structure:
1. The Problem — pain points with {competitors}
2. The Solution — what {product} does differently
3. Comparison Table — feature-by-feature
4. How It Works — code examples, install command
5. AI Integration — MCP server (if applicable)
6. Try It — install command, website, GitHub
```

### Product Hunt Template
```
Tagline: "{One-line value prop}. Free forever."
Description: 3-4 bullet points of differentiators
First Comment: Maker story — why you built it, what's different
Topics: 3-5 relevant PH topics
```

### HN Template
```
Title: "Show HN: {Product} – {tagline}"
URL: https://{domain}
Comment: Technical details, stack, key decisions, numbers
```

## Combining with /promote

```bash
# Full pipeline: technical promotion + organic promotion
/pipe promote full >> organic-promote

# Or step by step:
/pipe ai-index >> ship >> mcp-publish >> promote verify >> organic-promote
```

## Timeline After Running

| Action | Indexed By | ETA |
|--------|-----------|-----|
| Dev.to article | Google, Perplexity | Same day |
| Product Hunt | Google, ChatGPT | Same day |
| Hacker News | Google, ChatGPT, Perplexity | Same day |
| Reddit posts | Google, Perplexity | 1-2 days |
| Awesome list PRs merged | GitHub search, AI agents | 1-7 days |
| AlternativeTo listing | Google, ChatGPT | 2-5 days |
| Google AI Overview | ChatGPT browsing | 1-2 weeks |
| ChatGPT training data | ChatGPT (no browsing) | 2-8 weeks |

The fastest path: **Dev.to + Product Hunt + HN on the same day**. Google indexes all three within hours. Perplexity picks them up in real-time.
