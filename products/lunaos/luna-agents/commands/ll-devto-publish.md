---
name: ll-devto-publish
displayName: Luna Dev.to Publisher
description: Write and publish Dev.to articles about any project — with comedy styles (Curb, Seinfeld, The Office, Silicon Valley) or straight technical. Auto-publishes via API.
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
    description: "Product URL"
    required: true
    prompt: true
  - name: style
    type: string
    description: "Style: curb (Curb Your Enthusiasm), seinfeld (observational), office (Michael Scott), silicon-valley (tech satire), straight (no comedy), absurd (surreal humor)"
    required: false
    default: curb
  - name: topic
    type: string
    description: "What the article is about (e.g., 'why our tool is better than GitHub Actions')"
    required: true
    prompt: true
  - name: publish
    type: boolean
    description: "Auto-publish to Dev.to (requires DEV_TO_API_KEY in .env)"
    required: false
    default: true
workflow:
  - analyze_project
  - generate_article_in_style
  - review_and_refine
  - publish_to_devto
  - generate_social_snippets
output:
  - docs/launch/DEVTO_{topic}.md
  - .luna/{current-project}/devto-publish-report.md
mcp_servers:
  - git
  - fetch
---

# /devto-publish — Write & Ship Dev.to Articles

Write technical articles with personality. Auto-publish to Dev.to via API.

## Comedy Styles

### Curb Your Enthusiasm (`--style curb`)
Petty frustration about absurd industry norms. Escalating indignation. Deadpan disbelief.

> "So I'm looking at our GitHub Actions bill and I go — wait. We're paying... to LINT? We're paying someone to run eslint? I could run eslint. My toaster could run eslint."

> "Let me get this straight. You WROTE a config file. To TELL a computer. To run a TEST. That YOUR computer could run. For FREE."

**Tone rules:**
- Start calm, build to "what are we DOING here?"
- Talk directly at the reader like complaining at dinner
- "So you're telling me..." / "Let me get this straight..."
- The awkward silence moment when the DevOps guy realizes
- Always end with the product URL, never hashtags

### Seinfeld (`--style seinfeld`)
Observational comedy about everyday developer absurdity. "What's the deal with..."

> "What's the DEAL with YAML? It's not markup. It's not code. It's this weird in-between thing where one wrong space and your entire pipeline explodes. It's like the metric system of configuration."

> "You ever notice how setting up CI/CD takes longer than writing the actual code? That's like spending more time building the mailbox than writing the letter."

**Tone rules:**
- "What's the deal with [industry norm]?"
- Observational comparisons to everyday life
- Pop-out bits — "Not that there's anything wrong with Jenkins..."
- Jerry's incredulous tone when describing the obvious

### The Office (`--style office`)
Michael Scott energy. Confident ignorance. Cringe comedy.

> "Would I rather have working CI/CD or a pizza party? Trick question. PushCI gives you both because you save so much money on your CI bill you can afford a pizza party every day. — Michael Scott"

> "I'm not superstitious. But I am a little stitious. About YAML. Every time I write a YAML file, something bad happens. That's just science."

**Tone rules:**
- Michael Scott quotes (real or fabricated)
- "That's what she said" energy (keep it clean)
- Dwight-level obsession with the technical details
- Jim's deadpan camera look when something absurd happens
- Conference room meeting vibes

### Silicon Valley (`--style silicon-valley`)
Tech startup satire. Disruption theater. VC-speak.

> "We're not building CI/CD. We're building an AI-native infrastructure consciousness layer that democratizes developer velocity across the entire compute spectrum. Also it runs npm test. For free."

> "Our TAM is literally every developer who has ever written a YAML file and felt their soul leave their body. That's a $14 billion market."

**Tone rules:**
- Buzzword overload that circles back to something simple
- "We're making the world a better place" but for CI/CD
- Erlich Bachman confidence with Richard Hendricks reality
- Jian-Yang energy: "It's like GitHub Actions... but for your machine"

### Straight Technical (`--style straight`)
No comedy. Clean, authoritative technical writing.

**Tone rules:**
- Problem → Solution → Comparison → How to try
- Feature tables, code examples, benchmarks
- Professional but not boring

### Absurd (`--style absurd`)
Surreal humor. Monty Python meets tech.

> "In a world where developers spend more time configuring CI/CD than actual development, one tool dared to ask: what if we just... didn't? What if the computer figured it out itself? Critics called it 'lazy.' We call it 'AI.'"

**Tone rules:**
- Dramatic movie trailer narration for mundane things
- Personifying config files and pipelines
- Unexpected philosophical tangents
- "Brought to you by the letters Y, A, M, and L"

## Auto-Publish

Set `DEV_TO_API_KEY` in your `.env` file. Get one at https://dev.to/settings/extensions

The skill will:
1. Generate the article in your chosen style
2. Publish it to Dev.to via API
3. Return the published URL
4. Generate social media snippets for Twitter/LinkedIn

## Examples

```bash
# Curb style about your CI/CD tool
/devto-publish --product_name PushCI --domain pushci.dev \
  --style curb --topic "why YAML is dead"

# Seinfeld style about your database tool
/devto-publish --product_name MyDB --domain mydb.io \
  --style seinfeld --topic "what's the deal with database migrations"

# The Office style product launch
/devto-publish --product_name TeamApp --domain teamapp.com \
  --style office --topic "we built a project management tool"

# Silicon Valley VC pitch energy
/devto-publish --product_name CloudThing --domain cloudthing.io \
  --style silicon-valley --topic "disrupting the monitoring space"

# Straight technical comparison
/devto-publish --product_name MyTool --domain mytool.dev \
  --style straight --topic "comparing MyTool vs Datadog"

# Just generate, don't publish
/devto-publish --product_name MyApp --domain myapp.com \
  --style curb --topic "why our tool exists" --publish false
```

## Vibe-Coding Era Energy

All comedy styles lean into the vibe-coding reality:
- Nobody writes code anymore, AI does
- But we're still writing YAML configs by hand??
- The cognitive dissonance of 2026 dev workflows
- Claude builds your app but you manually configure CI
- "The AI writes your code. YOU write the YAML that tests it."
