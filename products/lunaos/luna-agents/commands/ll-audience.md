---
name: ll-audience
displayName: Luna Audience
description: Deep customer intelligence — analyze who uses your app, predict behavior, detect churn, identify upsell opportunities, and generate growth strategies
version: 1.0.0
category: strategy
agent: luna-analytics
parameters:
  - name: action
    type: string
    description: "Action: profile (who are they), predict (what will they do), churn (who's leaving), growth (how to grow), cohort (group analysis), health (customer health score), ideal (ideal customer profile)"
    required: true
    prompt: true
  - name: source
    type: string
    description: "Data source: codebase (from code), api (live data), mock (simulated), csv (import file)"
    required: false
    default: codebase
mcp_servers:
  - sequential-thinking
  - memory
  - fetch
  - git
  - jupyter
  - notebooklm
  - playwright
---

# /audience — Customer Intelligence Engine

Understand every customer segment. Predict behavior. Detect churn before it happens. Find your best growth opportunities. All from your codebase or real data.

## Actions

### /audience profile
```
Customer Profile Analysis:
├── WHO uses your product?
│   ├── Company sizes (startup/SMB/enterprise)
│   ├── Industries and verticals
│   ├── Technical roles (developer/PM/designer/exec)
│   ├── Geographic distribution
│   └── How they found you
│
├── HOW do they use it?
│   ├── Most-used features (from route analytics)
│   ├── Average session length
│   ├── Peak usage times
│   ├── Mobile vs desktop ratio
│   ├── API vs UI usage split
│   └── Integration patterns
│
├── WHY do they stay?
│   ├── Core value drivers per segment
│   ├── Feature stickiness scores
│   ├── Network effects (team size growth)
│   └── Switching cost analysis
│
└── WHAT do they pay?
    ├── Revenue distribution by segment
    ├── ARPU by plan tier
    ├── Expansion revenue patterns
    └── Price sensitivity indicators
```

### /audience predict
```
Behavioral Prediction:
├── UPGRADE LIKELIHOOD
│   ├── Users approaching plan limits
│   ├── Feature usage patterns that precede upgrades
│   ├── Team growth signals
│   └── Ranked list of upgrade-ready users
│
├── CHURN RISK
│   ├── Declining engagement patterns
│   ├── Support ticket sentiment analysis
│   ├── Feature abandonment signals
│   ├── Payment failure correlation
│   └── Risk score per customer (1-100)
│
├── EXPANSION OPPORTUNITIES
│   ├── Users who'd benefit from higher tier
│   ├── Teams ready for enterprise features
│   ├── API-heavy users who need custom plans
│   └── Revenue impact if converted
│
└── VIRAL POTENTIAL
    ├── Users most likely to refer
    ├── Social proof candidates (public companies, influencers)
    ├── Community contribution likelihood
    └── Case study candidates
```

### /audience churn
```
Churn Analysis & Prevention:
├── EARLY WARNING SIGNALS
│   ├── Login frequency dropping
│   ├── Feature usage declining
│   ├── Support tickets increasing
│   ├── Team members being removed
│   ├── API calls decreasing
│   └── Billing payment failures
│
├── CHURN REASONS (from your product)
│   ├── Missing features (what they tried but couldn't do)
│   ├── Complexity (features they never discovered)
│   ├── Performance (slow workflows, timeouts)
│   ├── Competition (features competitors have)
│   ├── Price (approaching budget limits)
│   └── Fit (wrong product for their use case)
│
├── SAVE PLAYBOOKS (auto-generated)
│   ├── For price-sensitive churners → offer annual discount
│   ├── For complexity churners → trigger onboarding replay
│   ├── For missing-feature churners → show roadmap
│   ├── For performance churners → escalate to engineering
│   └── For fit churners → suggest alternatives gracefully
│
└── PREVENTION ACTIONS
    ├── Automated re-engagement emails
    ├── In-app nudges for underused features
    ├── Personal outreach triggers
    └── Win-back campaigns for churned users
```

### /audience growth
```
Growth Strategy Generation:
├── ACQUISITION
│   ├── Best channels by persona type
│   ├── Content topics that attract each segment
│   ├── SEO keywords by customer intent
│   ├── Community platforms where users hang out
│   └── Partnership opportunities
│
├── ACTIVATION
│   ├── Onboarding optimization per persona
│   ├── Time-to-first-value benchmarks
│   ├── Activation rate by signup source
│   └── A/B test suggestions for onboarding
│
├── RETENTION
│   ├── Feature adoption playbooks
│   ├── Engagement loop design
│   ├── Community building strategy
│   └── Loyalty program design
│
├── REVENUE
│   ├── Pricing optimization opportunities
│   ├── Upsell trigger automation
│   ├── Annual plan conversion strategy
│   └── Enterprise sales playbook
│
└── REFERRAL
    ├── Viral loop design
    ├── Referral program structure
    ├── Ambassador program
    └── Case study pipeline
```

### /audience cohort
```
Cohort Analysis:
├── By signup date (monthly cohorts)
│   ├── Retention curves per cohort
│   ├── Revenue per cohort over time
│   └── Feature adoption by cohort
│
├── By acquisition source
│   ├── Organic vs paid vs referral
│   ├── LTV by source
│   └── Best-performing channels
│
├── By plan tier
│   ├── Free→Pro conversion rates
│   ├── Pro→Team upgrade patterns
│   ├── Enterprise adoption timeline
│   └── Revenue concentration risk
│
└── By behavior
    ├── Power users vs casual
    ├── API-first vs UI-first
    ├── Solo vs team users
    └── Feature-specific cohorts
```

### /audience health
```
Customer Health Score (per account):
┌──────────────────────────────────────┐
│  CUSTOMER: Acme Corp                  │
│  HEALTH SCORE: 72/100 ⚠️             │
│                                       │
│  ENGAGEMENT    ████████░░  78%        │
│  ├── Login frequency: daily           │
│  ├── Feature breadth: 6/12 features   │
│  └── API calls: 1,200/day            │
│                                       │
│  ADOPTION      ██████░░░░  62%        │
│  ├── Team seats used: 4/10           │
│  ├── Integrations: 2 active          │
│  └── Advanced features: 3/8 used     │
│                                       │
│  SATISFACTION  █████████░  85%        │
│  ├── Support tickets: 1 (resolved)   │
│  ├── NPS response: 8/10             │
│  └── Last feedback: positive         │
│                                       │
│  GROWTH        ██████████  95%        │
│  ├── Team growing (2 invites pending)│
│  ├── Approaching tier limit          │
│  └── Expansion revenue likely        │
│                                       │
│  ⚠️  ACTION: Low adoption score      │
│  → Trigger feature discovery email   │
│  → Schedule success call             │
└──────────────────────────────────────┘
```

### /audience ideal
```
Ideal Customer Profile (ICP):
├── FIRMOGRAPHICS
│   ├── Company size: 10-100 employees
│   ├── Industry: SaaS, fintech, developer tools
│   ├── Revenue: $1M-$50M ARR
│   ├── Funding: Series A-B
│   └── Tech stack: React, Node, Cloudflare/AWS
│
├── BUYER PERSONA
│   ├── Title: CTO, VP Engineering, Lead Developer
│   ├── Reports to: CEO or CPO
│   ├── Budget authority: $500-$5000/mo
│   ├── Decision timeline: 2-4 weeks
│   └── Evaluation criteria: speed, reliability, DX
│
├── BEHAVIORAL SIGNALS
│   ├── Uses CI/CD (GitHub Actions, CircleCI)
│   ├── Has 5+ developers
│   ├── Ships weekly or faster
│   ├── Already uses AI tools
│   └── Active on GitHub/Twitter/Discord
│
├── DISQUALIFIERS
│   ├── Less than 3 developers
│   ├── No cloud infrastructure
│   ├── Waterfall development process
│   └── Regulated industry needing on-prem only
│
└── LOOK-ALIKE TARGETING
    ├── Companies similar to best customers
    ├── GitHub repos with matching tech stacks
    ├── Job postings mentioning your stack
    └── Conference attendees in your space
```

## Usage

```bash
/audience profile                                          # Who uses your product
/audience predict                                          # Behavioral predictions
/audience churn                                            # Churn analysis + prevention
/audience growth                                           # Growth strategy
/audience cohort                                           # Cohort analysis
/audience health                                           # Customer health scores
/audience ideal                                            # Ideal customer profile
```

## In Pipes

```bash
# Full customer intelligence
/pipe audience profile >> audience predict >> audience growth >> present "growth strategy"

# Churn prevention workflow
/pipe audience churn >> ghost email "win-back campaign" >> publish

# Persona-driven product development
/pipe persona generate >> audience ideal >> compete "top 3" >> idea "what to build next"

# Data-driven pricing
/pipe audience cohort >> audience predict >> money >> persona interview "test new pricing"

# Customer success automation
/pipe audience health >> if $health < 70 >> ghost email "re-engagement" >> notify cs-team

# Growth experiment design
/pipe audience growth >> plan >> go *5 >> test >> audience predict >> pulse
```

## Output

```
.luna/{project}/audience/
  profile.md                     # Customer profile analysis
  predictions.json               # Behavioral predictions
  churn-analysis.md              # Churn risks and playbooks
  growth-strategy.md             # Growth recommendations
  cohorts/                       # Cohort analysis
    by-date.md
    by-source.md
    by-tier.md
  health-scores.json             # Per-customer health scores
  ideal-customer-profile.md      # ICP definition
  summary.md                     # Executive summary
```
