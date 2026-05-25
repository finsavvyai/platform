---
name: ll-curb
displayName: Luna Curb Writer
description: Transform marketing copy into Curb Your Enthusiasm-style content — awkward, honest, slightly aggressive developer humor
version: 1.0.0
category: content
agent: luna-documentation
parameters:
  - name: target
    type: string
    description: "What to rewrite: landing, pricing, readme, social, pitch, email, changelog, or a file path"
    required: false
    prompt: true
  - name: tone
    type: string
    description: "Intensity: mild (witty), medium (sarcastic), hot (Larry David at his worst)"
    required: false
    default: medium
mcp_servers:
  - git
  - fetch
  - memory
---

# /curb — Curb Your Marketing

Transform your product marketing into Curb Your Enthusiasm-style developer content. Awkward. Honest. Slightly aggressive. Surprisingly convincing.

## Usage

```bash
/curb                          # Rewrite entire landing page
/curb landing                  # Landing page copy
/curb pricing                  # Pricing section
/curb social                   # Generate 20 tweet-sized one-liners
/curb readme                   # README with personality
/curb pitch                    # Product Hunt / investor pitch
/curb email "welcome series"   # Onboarding emails with tone
/curb changelog                # Changelog that people actually read
/curb src/components/Hero.tsx  # Rewrite a specific file's copy
```

## The Curb Voice Rules

When generating content, follow these rules exactly:

### Tone
- **Petty frustration** about absurd industry norms (paying per minute, writing YAML to run tests, vendor lock-in)
- **Escalating indignation** — start calm, build to "what are we DOING here?"
- **Conversational rants** — talk directly at the reader like complaining to a friend at dinner
- **Deadpan disbelief** — "So you're telling me..." / "Let me get this straight..."
- **Awkward social moments** — the coworker stare, the DevOps guy going quiet

### Format Rules
- Never use hashtags or corporate speak
- Keep tweets under 280 characters
- The humor comes from the TRUTH — real developer pain, real pricing absurdity
- End landing pages with passive-aggressive CTAs
- Always contrast the absurd status quo with the obvious alternative

### Structure for Landing Pages

```
HERO: Bold complaint disguised as a headline
SUBHERO: The relatable rant (2-3 sentences, conversational)

PROBLEM ("Let me ask you something..."):
  - 3 rant cards (setup + punchline)
  - 4 one-liner punches as border-left quotes
  - The "invoice moment" — emotional turning point

SOLUTION: State what it does in the most understated way possible
  "PushCI.dev — run CI locally. That's it."

COMPARISON: Honest table with uncomfortable truths
  - Include "Emotional damage" as a real row
  - Cloud CI column: sarcastic quotes
  - Your product column: deadpan honesty

SOCIAL PROOF (kind of):
  - Fake-real testimonials that sound like therapy
  - "I stopped paying for CI and nothing bad happened. That worried me."

PRICING: One word. "Free."
  - Then the passive-aggressive footnote

CTA: "Or keep paying. That's fine. Totally fine."
```

### One-Liner Bank Template

Generate 20 lines in these categories:

**Existential (why does this exist):**
- Pattern: "[absurd thing] + [deadpan reaction]"
- Example: "I'm pushing code... why is there a meter running? What is this, a taxi?"

**Comparative (us vs them):**
- Pattern: "[their problem] vs [our non-problem]"
- Example: "I had two problems: slow pipelines and expensive pipelines. Now I just have slow pipelines."

**Observational (industry truths):**
- Pattern: "The cloud is great... until [uncomfortable truth]"
- Example: "You know what's scalable? Costs. Costs scale beautifully."

**Self-deprecating (honest about our own product):**
- Pattern: "[honest admission] + [but still better]"
- Example: "PushCI.dev — it's not better... it's just not charging you. Which somehow makes it better."

**Short punches (tweet-sized):**
- Pattern: [4-8 words, no fluff]
- "Stop renting your own CI."
- "Run builds. Not up a bill."
- "CI without invoices hits different."

## Workflow

### Step 1: Analyze the Project

Read these files to understand the product:
- `package.json`, `README.md`, `CLAUDE.md` — what it does
- Landing page components — existing copy
- Pricing data — what's free vs paid
- Competitor comparison data — what to roast

Extract:
- Product name and what it replaces
- Key value proposition (what's absurdly better)
- Competitor pain points (what to make fun of)
- Pricing advantage (the free angle)

### Step 2: Generate Curb Content

Based on the target, generate:

**Landing page**: Full page rewrite with all sections above
**Social**: 20 one-liners across all 5 categories
**Pricing**: Curb-style pricing section with passive-aggressive CTAs
**README**: Technical README but every section header is a complaint
**Pitch**: Product Hunt description in "Larry David pitching a startup" voice
**Email**: Onboarding sequence where each email gets progressively more honest
**Changelog**: Version notes that read like therapy sessions

### Step 3: Implement

- Write the actual component code (React/TSX)
- Maintain existing styling and framework
- Keep the Curb tone in JSX string literals
- Add a rotating quote ticker if applicable
- Ensure all CTAs point to real URLs

## Examples of Good Lines

From the PushCI landing page (the original implementation):

```
"Build minutes? What is this, a gym membership?"
"CI used to be a tool. Now it's a subscription. For what? For waiting?"
"The cloud is great... until it starts acting like a landlord."
"You know what's scalable? Costs. Costs scale beautifully."
"I stopped paying for CI and nothing bad happened. That worried me."
"You can keep paying for CI. I'm not judging. I am judging a little."
"Emotional damage: High vs Still high, but free"
```
