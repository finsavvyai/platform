---
name: ll-ghost
displayName: Luna Ghost Writer
description: AI content generation — blog posts, docs, changelogs, social posts, emails, landing pages from your codebase context
version: 1.0.0
category: content
agent: luna-documentation
parameters:
  - name: type
    type: string
    description: "Content type: blog, changelog, social, email, docs, landing, pitch, readme"
    required: true
    prompt: true
  - name: topic
    type: string
    description: Topic or context for the content
    required: false
mcp_servers:
  - git
  - fetch
  - memory
  - sequential-thinking
---

# /ghost — Content That Writes Itself

Generate any content from your codebase context. Luna reads your code, understands your product, and writes content that's technically accurate and on-brand.

## Content Types

```bash
/ghost blog "How we built real-time sync in 3 days"      # Technical blog post
/ghost changelog                                          # From git log → changelog
/ghost social "New feature: AI workflows"                 # Twitter thread + LinkedIn
/ghost email "Welcome new users"                          # Onboarding email sequence
/ghost docs                                               # API docs from code
/ghost landing "Enterprise features"                      # Landing page copy
/ghost pitch "Series A investor deck"                     # Pitch content
/ghost readme                                             # README from codebase analysis
```

## How It Works

```
/ghost blog "our new billing system"
              │
              ▼
   CONTEXT GATHERING
   ├── git log: recent billing-related commits
   ├── Code: billing service, webhook handlers
   ├── memory: product decisions, architecture choices
   ├── fetch: competitor billing approaches
   └── Brand voice from design system
              │
              ▼
   GENERATION
   ├── Outline with technical depth
   ├── Code snippets from actual codebase
   ├── Architecture diagrams (mermaid)
   ├── Before/after comparisons
   ├── Performance metrics
   └── Call-to-action
              │
              ▼
   POLISH
   ├── SEO optimization (meta, headings, keywords)
   ├── Readability score (Flesch-Kincaid)
   ├── Technical accuracy verification
   ├── Brand voice consistency
   └── Social media derivative versions
```

## In Pipes

```bash
/pipe launch production >> ghost changelog >> ghost social >> ghost email "release announcement"
/pipe go *5 >> test >> ship >> ghost blog "what we shipped this sprint"
/pipe ghost readme >> ghost docs >> ghost landing >> deploy docs
```
