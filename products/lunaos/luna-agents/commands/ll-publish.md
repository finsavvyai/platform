---
name: ll-publish
displayName: Luna Publish
description: Publish content anywhere — Medium, Product Hunt, Hacker News, Twitter/X, LinkedIn, Dev.to, Reddit, YouTube, Notion, Obsidian
version: 1.0.0
category: publishing
agent: luna-task-executor
parameters:
  - name: platform
    type: string
    description: "Platform: medium, producthunt, hackernews, twitter, linkedin, devto, reddit, youtube, notion, obsidian, all"
    required: true
    prompt: true
  - name: content
    type: string
    description: Content to publish — path to file, topic, or "auto" to generate from recent activity
    required: false
    default: auto
  - name: type
    type: string
    description: "Content type: launch, feature, blog, changelog, security-advisory, tutorial, thread"
    required: false
    default: blog
mcp_servers:
  - fetch
  - git
  - playwright
  - memory
  - zai-mcp-server
  - sequential-thinking
---

# /publish — Ship Content Everywhere

Write once, publish everywhere. Or let Luna auto-generate the content from your codebase and publish it.

## Platforms

### /publish producthunt
```
Auto-generates Product Hunt launch:
├── Tagline (< 60 chars)
├── Description (maker's comment)
├── 5 product screenshots (from /record or playwright)
├── Thumbnail with logo
├── First comment (technical details)
├── Topics and tags
└── Scheduled for optimal time (Tuesday 12:01 AM PT)
```

### /publish hackernews
```
Generates HN-optimized post:
├── Title (Show HN: ...) — optimized for HN style
├── Body with technical substance
├── Link to repo/demo
├── Talking points for comments
└── Follow-up comments prepared
```

### /publish medium
```
Full Medium article:
├── Title, subtitle, cover image
├── SEO-optimized content
├── Code snippets with syntax highlighting
├── Architecture diagrams (mermaid → images)
├── Publication targeting (suggest best pubs)
└── Tags for discoverability
```

### /publish notion
```
Structured Notion page:
├── Database entry with properties
├── Rich content with toggles, callouts
├── Embedded images and diagrams
├── Linked to related pages
└── Team workspace organized
```

### /publish obsidian
```
Obsidian markdown note:
├── Frontmatter (tags, date, links)
├── Wikilinks to related notes
├── Code blocks with language tags
├── Mermaid diagrams (native rendering)
├── Dataview-compatible metadata
└── Saved to your vault path
```

### /publish twitter (thread)
```
Twitter/X thread:
├── Hook tweet (attention-grabbing)
├── 5-8 thread tweets (one idea per tweet)
├── Code screenshots (from carbon.now.sh)
├── Demo GIF (from /record)
├── CTA with link
└── Scheduled for optimal engagement time
```

## Usage

```bash
/publish producthunt --type launch                        # PH launch
/publish hackernews --type feature --content "new AI workflows"
/publish medium --content auto                            # Auto from recent commits
/publish all --type changelog                             # Publish changelog everywhere
/publish notion --content ./docs/architecture.md          # Sync to Notion
/publish obsidian --content auto --type blog              # Daily dev journal
/publish twitter --type thread --content "how we built billing in 5 minutes"
```

## In Pipes

```bash
/pipe launch production >> ghost changelog >> publish all
/pipe go *5 >> test >> ship >> record "demo" >> publish producthunt
/pipe ghost blog "how we did X" >> publish medium >> publish twitter >> publish linkedin
/pipe collab retro >> present sprint >> publish notion >> share team
/pipe guard audit >> publish obsidian --type security-advisory
```
