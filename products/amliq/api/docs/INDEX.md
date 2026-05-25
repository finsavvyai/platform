# AMLIQ v2 Documentation Index

Welcome! This is the entry point for all AMLIQ documentation. Choose your path based on what you need.

## 🚀 Quick Start (First Time?)

1. **Read CLAUDE.md** (3 min) — Project overview, critical rules, directory map
2. **Read VISION.md** (5 min) — Product vision, market, 5 products
3. **Read ARCHITECTURE.md** (10 min) — How the system works end-to-end
4. **Read CODE_MAP.md** (10 min) — Where every file lives and why

**Total: 28 minutes to understand the full system.**

---

## 📚 Documentation by Topic

### For Product Managers / Business

| Document | Purpose |
|----------|---------|
| **VISION.md** | Market opportunity, competitive landscape, revenue model |
| **BILLING_MODEL.md** | 5 products × 3 tiers, pricing, usage metering |
| **API_REFERENCE.md** | What developers can do with AMLIQ |

### For Developers (New to Project)

| Document | Purpose |
|----------|---------|
| **CLAUDE.md** | AI instruction file, quick overview |
| **ARCHITECTURE.md** | System layers, data flow, design decisions |
| **CODE_MAP.md** | Every directory explained with examples |
| **DOMAIN_MODEL.md** | Entity reference, value objects, types |
| **CONVENTIONS.md** | Coding standards (Go + React) |
| **EXTENDING.md** | Step-by-step guides for common extensions |

### For Specific Features

| Document | What It Covers |
|----------|----------------|
| **SCREENING_ENGINE.md** | 6-layer matching algorithm details |
| **SECURITY.md** | Authentication, encryption, RBAC, audit |
| **AI_GATEWAY_ENV.md** | AI endpoint env vars (Anthropic / Bedrock / DLP / quota) |
| **SAML_SSO_SETUP.md** | Per-tenant SAML onboarding runbook |
| **PILOT_ONBOARDING.md** | End-to-end Pilot customer onboarding (single-page) |
| **SELF_HOSTING.md** | sdlc.cc self-host: SaaS / VPC / air-gapped (no AWS) |
| **TESTING.md** | Test patterns, coverage goals, CI/CD |
| **GLOSSARY.md** | AML terminology, acronyms, concepts |

### For AI Assistants

| Document | Purpose |
|----------|---------|
| **.cursorrules** | Cursor AI specific rules (file size, patterns) |
| **.github/copilot-instructions.md** | GitHub Copilot specific rules |
| **CLAUDE.md** | This entire documentation is for AI understanding |

---

## 🎯 Common Tasks & Where to Find Answers

### "How do I..."

| Question | Answer |
|----------|--------|
| ...run the project? | **CLAUDE.md** → "How to Run" |
| ...add a screening matcher? | **EXTENDING.md** → "Add New Matcher" |
| ...add an API endpoint? | **EXTENDING.md** → "Add New Endpoint" |
| ...understand the matching engine? | **SCREENING_ENGINE.md** (detailed algorithm walkthrough) |
| ...set up React component? | **EXTENDING.md** → "Add React Page" |
| ...add a billing product? | **EXTENDING.md** → "Add Billing Product" |
| ...write tests? | **TESTING.md** (table-driven pattern) |
| ...understand domain models? | **DOMAIN_MODEL.md** (entity reference) |
| ...secure an endpoint? | **SECURITY.md** → "Authorization" |
| ...understand product vision? | **VISION.md** |
| ...find a file? | **CODE_MAP.md** |
| ...understand a term? | **GLOSSARY.md** |

---

## 📁 Documentation Structure

```
/
├── CLAUDE.md                     ← START HERE (AI instruction file)
├── README.md                     ← Project overview
├── .cursorrules                  ← Cursor AI instructions
│
└── docs/
    ├── INDEX.md                  ← You are here
    ├── VISION.md                 ← Product vision
    ├── ARCHITECTURE.md           ← System design
    ├── CODE_MAP.md               ← File directory
    ├── DOMAIN_MODEL.md           ← Entity types
    ├── SCREENING_ENGINE.md       ← 6-layer matching
    ├── BILLING_MODEL.md          ← Pricing, products
    ├── API_REFERENCE.md          ← All endpoints
    ├── EXTENDING.md              ← How to add features
    ├── CONVENTIONS.md            ← Coding standards
    ├── SECURITY.md               ← Auth, encryption, RBAC
    ├── TESTING.md                ← Test patterns
    ├── GLOSSARY.md               ← AML terminology
    └── DATA_FLOW.md              ← Request lifecycles (coming)
```

---

## 🔄 Request Lifecycle (High Level)

```
API Request
    ↓
CLAUDE.md → Understand project
    ↓
ARCHITECTURE.md → See system design
    ↓
CODE_MAP.md → Find the relevant code
    ↓
Read actual code → Understand implementation
    ↓
EXTENDING.md → Add your feature
    ↓
CONVENTIONS.md → Follow standards
    ↓
TESTING.md → Write tests
    ↓
.cursorrules → Validate with AI rules
```

---

## 🎓 Learning Paths

### Path 1: Quick Understanding (30 min)
1. CLAUDE.md (3 min) — Overview
2. VISION.md (5 min) — Why it exists
3. ARCHITECTURE.md (10 min) — How it works
4. CODE_MAP.md (10 min) — Where things are
5. You're ready to start coding!

### Path 2: Deep Technical (2 hours)
1. CLAUDE.md
2. ARCHITECTURE.md
3. DOMAIN_MODEL.md (entities)
4. CODE_MAP.md (file locations)
5. SCREENING_ENGINE.md (matching)
6. CONVENTIONS.md (standards)
7. SECURITY.md (auth/encryption)
8. TESTING.md (test patterns)
9. EXTENDING.md (how to add)

### Path 3: Business/Product (45 min)
1. VISION.md (product vision)
2. BILLING_MODEL.md (pricing)
3. API_REFERENCE.md (capabilities)
4. GLOSSARY.md (terminology)

### Path 4: Add a Feature (1-2 hours)
1. EXTENDING.md (feature checklist)
2. CODE_MAP.md (file locations)
3. CONVENTIONS.md (coding standards)
4. TESTING.md (test patterns)
5. Read similar existing code
6. Implement following patterns
7. Validate with .cursorrules

---

## 🎯 Key Concepts at a Glance

### AMLIQ in 30 Seconds
- **What**: AI-powered sanctions screening (replace World-Check)
- **Who**: Banks, fintechs, payment processors
- **Why**: Cheaper, explainable, faster than legacy systems
- **How**: 6-layer matching (Exact, Fuzzy, Phonetic, Token, Embedding, Graph)
- **Products**: API, Dashboard, SDK, iFrame, Dataset (5 products)

### Critical Rules
1. **Every file ≤100 lines** (no exceptions)
2. **Table-driven tests** (Go, non-negotiable)
3. **Validate on construction** (value objects)
4. **No panic() in production** (return errors)
5. **Small interfaces** (≤3 methods)

### 6-Layer Matching Engine
```
Exact (0.1ms)      → Character match
Fuzzy (1ms)        → Jaro-Winkler (92% similar)
Phonetic (2ms)     → Soundex (sounds alike)
Token (3ms)        → Jaccard (word overlap)
Embedding (10ms)   → Vector cosine (semantic)
Graph (20ms)       → Relationship traversal
         ↓
    Weighted Score
         ↓
    Confidence (0-100)
         ↓
    Alert if > threshold
```

### 5 Products
1. **API** — RESTful screening service ($500-custom/month)
2. **Dashboard** — Web UI for compliance ($1k-custom/month)
3. **SDK** — Offline library (Go/Python/Node.js) ($1.5k-custom/month)
4. **iFrame** — Embedded widget ($500-custom/month)
5. **Dataset** — Raw sanctions data ($200-custom/month)

---

## 🔗 Cross-Reference

### By File Type

**Go Code** → Read CONVENTIONS.md (Go section) + CODE_MAP.md

**React Code** → Read CONVENTIONS.md (React section) + CODE_MAP.md

**Domain Models** → DOMAIN_MODEL.md + relevant entity file

**API Endpoints** → API_REFERENCE.md + handler file

**Tests** → TESTING.md + similar test file in codebase

**Database** → CODE_MAP.md (migrations/) + actual SQL file

---

## ❓ FAQ

**Q: Where do I start?**
A: Read CLAUDE.md, then ARCHITECTURE.md.

**Q: How do I understand the matching engine?**
A: Read SCREENING_ENGINE.md — it explains all 6 layers with examples.

**Q: What's the critical rule I must follow?**
A: **Every file ≤100 lines.** No exceptions. Split if needed.

**Q: How do I write tests?**
A: Read TESTING.md. Go uses table-driven tests, React uses RTL.

**Q: Where's the domain model?**
A: DOMAIN_MODEL.md has entity reference. Actual code in `internal/domain/`.

**Q: How do I add a feature?**
A: EXTENDING.md has step-by-step guides for matchers, parsers, endpoints, components, products.

**Q: What's the code style?**
A: CONVENTIONS.md. TL;DR: PascalCase types, camelCase functions, small files, small interfaces.

**Q: Is there an API?**
A: Yes! API_REFERENCE.md lists all endpoints with examples.

**Q: How does billing work?**
A: BILLING_MODEL.md explains 5 products × 3 tiers, usage metering, LemonSqueezy integration.

**Q: How secure is this?**
A: SECURITY.md covers TLS, JWT, API keys, encryption, RBAC, audit trail, secrets.

---

## 🚨 Don't Miss

1. **CLAUDE.md** — The master instruction file for all AIs
2. **CRITICAL RULE**: Every file ≤100 lines
3. **.cursorrules** — Rules for Cursor AI
4. **.github/copilot-instructions.md** — Rules for GitHub Copilot
5. **TESTING.md** — How to write tests (table-driven, RTL)
6. **EXTENDING.md** — Step-by-step feature guides

---

## 📞 Still Have Questions?

1. Check **GLOSSARY.md** for terminology
2. Look at **CODE_MAP.md** for file locations
3. Read the actual code (best source of truth)
4. Check if similar feature already exists
5. Read the test for that feature (very educational)

---

**Start with CLAUDE.md. Everything else builds from there.**

Last Updated: March 26, 2024
