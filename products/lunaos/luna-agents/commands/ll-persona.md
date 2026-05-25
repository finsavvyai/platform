---
name: ll-persona
displayName: Luna Persona
description: Generate detailed user personas from your app's code, data model, and user flows — with AI avatars, journey maps, and behavioral profiles
version: 1.0.0
category: strategy
agent: luna-requirements-analyzer
parameters:
  - name: action
    type: string
    description: "Action: generate (create personas), analyze (profile real users), journey (map user journeys), interview (simulate user interviews), segment (cluster users), empathy (empathy maps)"
    required: true
    prompt: true
  - name: source
    type: string
    description: "Source: auto (from codebase), data (from analytics), manual (you describe), url (analyze competitor users)"
    required: false
    default: auto
mcp_servers:
  - sequential-thinking
  - memory
  - fetch
  - playwright
  - zai-mcp-server
  - stability-ai
  - git
  - elevenlabs
  - notebooklm
---

# /persona — Know Your Users Before They Know Themselves

Generate rich, data-driven user personas from your actual codebase. Luna reads your routes, features, auth flows, billing tiers, and data model to create personas that are grounded in what your product actually does — not marketing fiction.

## What Luna Analyzes

```
/persona generate
         │
         ▼
   READ YOUR CODEBASE
   ├── Auth system → who can sign up? (email, OAuth, SSO)
   ├── Billing tiers → what plan levels exist?
   ├── RBAC/permissions → what roles exist? (admin, member, viewer)
   ├── Features per tier → what's gated behind paid plans?
   ├── API scopes → what integrations exist?
   ├── Onboarding flow → what's the first-run experience?
   ├── Dashboard layout → what metrics do users see?
   ├── Settings page → what can users customize?
   ├── Mobile app → is there a mobile experience?
   └── Data model → what entities do users create/manage?
         │
         ▼
   GENERATE PERSONAS (3-5 primary)
   ├── Each persona includes:
   │   ├── Name, age, role, company size
   │   ├── AI-generated avatar photo (Stability AI)
   │   ├── Goals and motivations
   │   ├── Pain points and frustrations
   │   ├── Technical proficiency level
   │   ├── Features they use most
   │   ├── Billing tier they're on
   │   ├── Devices and platforms
   │   ├── Key workflows (mapped to your actual routes)
   │   ├── Objections before purchasing
   │   ├── What makes them churn
   │   └── Quotes (in their voice)
   │
   └── Persona types derived from YOUR product:
       ├── Free tier explorer
       ├── Pro power user
       ├── Team admin/manager
       ├── Enterprise decision maker
       ├── Developer/API consumer
       ├── Non-technical end user
       └── (custom based on your roles/tiers)
```

## Actions

### /persona generate
```
Creates 3-5 detailed personas:

┌──────────────────────────────────────────┐
│  👤 PERSONA 1: "Alex Chen"               │
│  Role: Senior Full-Stack Developer        │
│  Company: Series A startup (25 people)    │
│  Plan: Pro ($29/mo)                       │
│  Tech: React, Node, AWS → migrating to CF│
│                                           │
│  GOALS                                    │
│  • Deploy AI agents without infra hassle  │
│  • Automate code review and testing       │
│  • Ship faster with small team            │
│                                           │
│  PAIN POINTS                              │
│  • Current CI/CD too slow                 │
│  • Manual deployment process error-prone  │
│  • Can't afford dedicated DevOps hire     │
│                                           │
│  KEY WORKFLOWS                            │
│  • /dashboard → /agents → /agents/studio  │
│  • /dashboard/chains → /chains/builder    │
│  • /dashboard/api-keys (uses API daily)   │
│                                           │
│  CHURN RISK                               │
│  • If agent execution is unreliable       │
│  • If pricing increases without warning   │
│  • If competitors offer better CLI        │
│                                           │
│  QUOTE                                    │
│  "I need something that just works. I     │
│   don't have time to debug my tools."     │
└──────────────────────────────────────────┘
```

### /persona analyze
```
Profile real users from analytics/data:
├── Cluster users by behavior patterns
├── Identify power users vs casual users
├── Map feature adoption by segment
├── Detect churn signals per persona
├── Revenue concentration by persona type
├── Support ticket patterns by persona
└── Recommends product changes per segment
```

### /persona journey
```
User Journey Map (per persona):
├── AWARENESS: How they discover your product
│   ├── Search terms they'd use
│   ├── Communities they're in
│   └── Content that would attract them
│
├── CONSIDERATION: What they evaluate
│   ├── Features they compare
│   ├── Competitors they check
│   ├── Pricing sensitivity
│   └── Questions they'd ask
│
├── ONBOARDING: First 10 minutes
│   ├── Signup friction points
│   ├── Time to first value
│   ├── "Aha moment" trigger
│   └── Drop-off risk points
│
├── ACTIVATION: First week
│   ├── Key actions that predict retention
│   ├── Features they try first
│   ├── Support needs
│   └── Upgrade triggers
│
├── RETENTION: Ongoing usage
│   ├── Daily/weekly workflows
│   ├── Feature depth over time
│   ├── Team expansion triggers
│   └── Advocacy signals
│
└── EXPANSION: Growth
    ├── Upgrade triggers
    ├── Team invite patterns
    ├── API integration depth
    └── Referral likelihood
```

### /persona interview
```
Simulate user interviews with AI:
├── Luna role-plays AS each persona
├── You ask questions, persona responds in character
├── Grounded in your actual product features
├── Tests messaging, pricing, feature ideas
├── Voice mode available (ElevenLabs — each persona has unique voice)
├── Transcript saved for reference
└── Insights extracted and summarized
```

### /persona segment
```
User Segmentation Analysis:
├── Behavioral clusters (usage patterns)
├── Value-based segments (revenue tiers)
├── Engagement segments (active/at-risk/churned)
├── Feature adoption segments
├── Platform segments (web/mobile/API/CLI)
├── Growth potential scoring
└── Actionable recommendations per segment
```

### /persona empathy
```
Empathy Map (per persona):
┌────────────────┬────────────────┐
│   THINKS       │    FEELS       │
│ "Is this worth │ Excited about  │
│  the price?"   │ AI automation  │
│ "Can my team   │ Anxious about  │
│  adopt this?"  │ vendor lock-in │
├────────────────┼────────────────┤
│   SAYS         │    DOES        │
│ "We need to    │ Compares 3     │
│  ship faster"  │ tools before   │
│ "Show me ROI"  │ committing     │
│                │ Trials free    │
│                │ tier first     │
└────────────────┴────────────────┘
```

## Usage

```bash
/persona generate                                          # Auto from codebase
/persona generate --source url https://competitor.com      # Competitor's users
/persona analyze                                           # Profile real users
/persona journey "Alex Chen"                               # Journey map for persona
/persona interview                                         # Simulate user interviews
/persona segment                                           # Cluster users
/persona empathy "Alex Chen"                               # Empathy map
```

## In Pipes

```bash
# Product development informed by personas
/pipe persona generate >> idea "solve their biggest pain" >> plan >> go *5

# Marketing targeted by persona
/pipe persona generate >> ghost blog "content for each persona" >> publish all

# Pricing validation
/pipe persona generate >> money >> persona interview "test pricing reactions"

# Full product strategy
/pipe compete "competitor.com" >> persona generate >> persona journey >> present "product strategy"

# Onboarding optimization
/pipe persona journey >> e2e-flow >> browser-test >> fix >> persona interview "test new onboarding"

# Voice of customer
/pipe persona interview >> voice podcast "user insights" >> publish notion

# Feature prioritization
/pipe persona segment >> persona empathy >> present "feature priorities" >> share team
```

## Output

```
.luna/{project}/personas/
  personas.md                    # All personas in detail
  avatars/                       # AI-generated avatar images
    persona-1.png
    persona-2.png
  journeys/                      # Journey maps per persona
    alex-chen-journey.md
    sarah-kim-journey.md
  segments/                      # Segmentation analysis
    segments.json
    segment-recommendations.md
  interviews/                    # Simulated interview transcripts
    alex-chen-interview.md
  empathy-maps/                  # Empathy maps
    alex-chen-empathy.md
  summary.md                     # Executive summary
```

## What Makes This Different

| Traditional Personas | Luna Personas |
|---------------------|---------------|
| Made up in a workshop | Generated from your actual code |
| Based on assumptions | Based on your data model, roles, tiers |
| Static document | Living — updates as your product evolves |
| Text-only | AI avatars, voice simulations, journey maps |
| Generic demographics | Mapped to your specific routes and features |
| Can't validate | Simulate interviews to test ideas |
| One-time exercise | `/persona generate` anytime product changes |
