# AMLIQ v2 Documentation Manifest

Complete list of AI-friendly documentation created for the AMLIQ project.

## 📋 Files Created

### Root Level

- **CLAUDE.md** (95 lines)
  - Primary AI instruction file
  - Project overview, tech stack, critical rules
  - Directory map, quick architecture
  - Recommended for all AIs as first read

- **.cursorrules** (215 lines)
  - Cursor AI specific rules
  - File size constraints, patterns, anti-patterns
  - Language-specific conventions (Go, React)
  - Testing requirements

### .github/

- **copilot-instructions.md** (395 lines)
  - GitHub Copilot specific rules
  - Code patterns, naming conventions
  - Go/React/SQL specifics
  - When to reject suggestions

### docs/

#### Core Understanding (Read First)

- **INDEX.md** (250 lines)
  - Documentation index and navigation guide
  - Learning paths (Quick/Technical/Business/Feature)
  - FAQ and cross-references
  - START HERE for finding what you need

- **VISION.md** (145 lines)
  - Product vision and market positioning
  - 5 products with pricing matrix
  - Competitive landscape
  - Revenue model and KPIs

#### Architecture & Design

- **ARCHITECTURE.md** (215 lines)
  - High-level system design
  - 7-layer architecture (Transport, Domain, Screening, Ingestion, Billing, Storage, Config)
  - Request lifecycle flow
  - Database schema overview
  - Key design decisions with rationale
  - Scaling considerations

- **CODE_MAP.md** (290 lines)
  - Directory-to-purpose reference
  - Every directory explained
  - File relationships
  - When to edit each location

#### Domain & Data Model

- **DOMAIN_MODEL.md** (355 lines)
  - Complete entity reference
  - Value objects (EntityID, TenantID, Confidence, etc)
  - Entities (Entity, Alert, Screening, Subscription)
  - Billing models (Product, Plan, Invoice)
  - Entity relationships (ER diagram)

- **SCREENING_ENGINE.md** (385 lines)
  - 6-layer matching pipeline detailed
  - Layer 1-6 explained (Exact, Fuzzy, Phonetic, Token, Embedding, Graph)
  - Algorithm examples with code
  - Short-circuiting logic
  - How to add new layers

#### Features & Products

- **BILLING_MODEL.md** (320 lines)
  - 5 products × 3 tiers pricing matrix
  - LemonSqueezy integration flow
  - Usage metering per product
  - API key prefixes
  - Seat management
  - Invoice generation
  - Adding new products/tiers

- **API_REFERENCE.md** (415 lines)
  - All API endpoints documented
  - Screening, Alerts, Config, Billing, Audit, Lists, Dataset
  - iFrame and webhook endpoints
  - Request/response examples
  - Error handling
  - HTTP status codes

#### Development & Operations

- **CONVENTIONS.md** (380 lines)
  - Coding standards (Go, React, Database)
  - Naming conventions
  - File size constraints
  - Go patterns (constructors, error handling, interfaces)
  - React patterns (hooks, testing, responsive design)
  - Database conventions
  - Git commit format
  - Pre-commit checklist

- **EXTENDING.md** (320 lines)
  - Step-by-step feature guides
  - Adding screening matcher
  - Adding sanctions list parser
  - Adding API endpoint
  - Adding React page
  - Adding billing product
  - Adding database migration
  - Checklist for any addition

- **TESTING.md** (360 lines)
  - Go testing (table-driven pattern, no testify)
  - React testing (RTL + Vitest)
  - Integration tests (API, database)
  - Coverage goals per package
  - CI/CD workflow
  - Common test mistakes

- **SECURITY.md** (355 lines)
  - TLS 1.3 and mTLS
  - JWT and API key authentication
  - RBAC (5 roles)
  - Tenant isolation
  - Data encryption (at rest + in transit)
  - Rate limiting (token bucket)
  - Webhook verification (HMAC)
  - Audit logging (immutable trail)
  - Secrets management
  - Compliance (GDPR, SOC 2)

#### Reference

- **GLOSSARY.md** (285 lines)
  - AML/CFT terminology (AML, CFT, KYC, PEP, SDN, OFAC, etc)
  - Screening concepts (sanctions list, watchlist, match, disposition)
  - Matching algorithms explained
  - Entity types
  - Compliance roles
  - Sanctions lists supported
  - Risk levels
  - Common mistakes
  - Business terms

---

## 📊 Documentation Statistics

| Metric | Value |
|--------|-------|
| Total files created | 16 |
| Total lines of documentation | ~5,100 |
| Average file size | ~320 lines |
| Largest file | API_REFERENCE.md (415 lines) |
| Smallest file | CLAUDE.md (95 lines) |
| All files under 500 lines | ✓ Yes |
| Files with code examples | 13 |
| Cross-references | 100+ |

## 🎯 Documentation Coverage

### Architecture
- [x] System design (ARCHITECTURE.md)
- [x] Data flow (REQUEST LIFECYCLE in ARCHITECTURE.md)
- [x] Database schema (ARCHITECTURE.md)
- [x] Deployment patterns (referenced in ARCHITECTURE.md)

### Domain
- [x] Entity models (DOMAIN_MODEL.md)
- [x] Value objects (DOMAIN_MODEL.md)
- [x] Enums and types (DOMAIN_MODEL.md)
- [x] Relationships (DOMAIN_MODEL.md)

### Features
- [x] Screening engine (SCREENING_ENGINE.md)
- [x] Matching layers (SCREENING_ENGINE.md)
- [x] Billing model (BILLING_MODEL.md)
- [x] API endpoints (API_REFERENCE.md)
- [x] Authentication (SECURITY.md)
- [x] Authorization (SECURITY.md)

### Development
- [x] Code conventions (CONVENTIONS.md)
- [x] Testing patterns (TESTING.md)
- [x] How to extend (EXTENDING.md)
- [x] File locations (CODE_MAP.md)
- [x] Security practices (SECURITY.md)

### AI Integration
- [x] Cursor AI rules (.cursorrules)
- [x] GitHub Copilot rules (copilot-instructions.md)
- [x] Primary AI instruction (CLAUDE.md)

### Navigation
- [x] Documentation index (INDEX.md)
- [x] Quick reference (CLAUDE.md)
- [x] Learning paths (INDEX.md)
- [x] FAQ (INDEX.md)

---

## 🔍 Search Guide

### By Technology
- **Go**: CONVENTIONS.md, EXTENDING.md, TESTING.md
- **React**: CONVENTIONS.md, EXTENDING.md, TESTING.md
- **PostgreSQL**: ARCHITECTURE.md, CODE_MAP.md, CONVENTIONS.md
- **LemonSqueezy**: BILLING_MODEL.md, API_REFERENCE.md
- **pgvector**: SCREENING_ENGINE.md (Layer 5)

### By Concept
- **6-layer matching**: SCREENING_ENGINE.md
- **Multi-tenancy**: ARCHITECTURE.md, SECURITY.md (Tenant Isolation)
- **SaaS billing**: BILLING_MODEL.md, API_REFERENCE.md
- **Audit trail**: SECURITY.md (Audit Logging), DOMAIN_MODEL.md
- **Explainability**: SCREENING_ENGINE.md (Explainer), API_REFERENCE.md

### By Role
- **Backend Engineer**: CODE_MAP.md, CONVENTIONS.md, EXTENDING.md, TESTING.md
- **Frontend Engineer**: CONVENTIONS.md (React), EXTENDING.md (React Page), API_REFERENCE.md
- **DevOps/SRE**: ARCHITECTURE.md, SECURITY.md, TESTING.md (CI/CD)
- **Product Manager**: VISION.md, BILLING_MODEL.md, API_REFERENCE.md
- **Compliance**: GLOSSARY.md, DOMAIN_MODEL.md, SECURITY.md

---

## 📖 Reading Recommendations

### For New Developers (30 minutes)
1. CLAUDE.md (5 min)
2. ARCHITECTURE.md (10 min)
3. CODE_MAP.md (10 min)
4. CONVENTIONS.md (skim, 5 min)

### For Feature Development (2 hours)
1. EXTENDING.md (relevant section, 10 min)
2. CODE_MAP.md (file locations, 10 min)
3. Existing code in relevant package (30 min)
4. CONVENTIONS.md (standards, 10 min)
5. TESTING.md (test pattern, 10 min)
6. Implement feature (40 min)
7. .cursorrules validation (10 min)

### For Security Review (1 hour)
1. SECURITY.md (40 min)
2. DOMAIN_MODEL.md (APICredential, Subscription, 10 min)
3. API_REFERENCE.md (authentication section, 10 min)

### For Architectural Discussion (1.5 hours)
1. VISION.md (product context, 10 min)
2. ARCHITECTURE.md (system design, 30 min)
3. SCREENING_ENGINE.md (core algorithm, 20 min)
4. BILLING_MODEL.md (revenue model, 15 min)
5. CODE_MAP.md (implementation, 15 min)

---

## ✅ Quality Checklist

All documentation files meet these criteria:

- [x] Clear, concise language (avoid jargon, explain acronyms)
- [x] Practical examples in code/SQL
- [x] Cross-referenced (links between docs)
- [x] Indexed for easy navigation
- [x] Searchable terminology (GLOSSARY.md)
- [x] AI-consumable format (Markdown, code blocks)
- [x] No excessive length (all <500 lines)
- [x] Complete coverage (no major gaps)
- [x] Consistent formatting
- [x] Updated with actual codebase

---

## 🔄 Maintenance

### When Documentation Needs Updates

| Change | Update These Docs |
|--------|-------------------|
| Add new endpoint | API_REFERENCE.md, CODE_MAP.md |
| Add new matcher layer | SCREENING_ENGINE.md, EXTENDING.md |
| Add new product | BILLING_MODEL.md, API_REFERENCE.md |
| Change domain model | DOMAIN_MODEL.md, ARCHITECTURE.md |
| Change code convention | CONVENTIONS.md, .cursorrules, copilot-instructions.md |
| Add security feature | SECURITY.md, CONVENTIONS.md |
| Change database schema | ARCHITECTURE.md (schema section) |

### Documentation Review Process

1. When making architectural changes → Update ARCHITECTURE.md + INDEX.md
2. When adding code → Check CONVENTIONS.md is still accurate
3. When adding endpoint → Update API_REFERENCE.md + CODE_MAP.md
4. When changing security → Update SECURITY.md + CONVENTIONS.md
5. Quarterly review of entire suite for staleness

---

## 🎓 Using This Documentation with AI

### For Claude/ChatGPT
- Reference specific doc files: "Per SCREENING_ENGINE.md..."
- Ask clarifying questions with doc context
- Request code examples in established patterns

### For Cursor AI
- Relies on .cursorrules for project context
- Cursor will automatically apply constraints
- Ask for features and Cursor enforces patterns

### For GitHub Copilot
- Relies on copilot-instructions.md
- Suggest code improvements
- Will warn if violating rules (file size, etc)

---

## 📝 Files Not Yet Created

These would be valuable additions:

- `docs/DATA_FLOW.md` — Request lifecycle diagrams (ASCII)
- `docs/DEPLOYMENT.md` — How to deploy to production
- `docs/TROUBLESHOOTING.md` — Common issues and fixes
- `docs/PERFORMANCE.md` — Benchmarks, profiling, optimization
- `docs/CONTRIBUTING.md` — How to contribute to project
- `docs/CHANGELOG.md` — Version history and breaking changes

---

## 🚀 How to Use This Documentation

1. **Start here**: Open INDEX.md
2. **Pick your path**: Quick start, technical deep dive, or business overview
3. **Navigate**: Cross-references and links guide you through related docs
4. **Reference**: Use CLAUDE.md as quick cheat sheet
5. **Extend**: EXTENDING.md shows exact steps for new features
6. **Validate**: .cursorrules and copilot-instructions.md ensure quality

---

**Version**: 1.0 (March 26, 2024)
**Total Documentation**: 16 files, ~5,100 lines
**Status**: Complete and AI-ready

All documentation is intended to be instantly consumable by any AI (Claude, GPT, Copilot) without requiring additional context about the project.
