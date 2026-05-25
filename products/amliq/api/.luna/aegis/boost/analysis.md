# Project Analysis — AMLIQ (Aegis)

## Classification

| Attribute | Value |
|-----------|-------|
| **Domain** | FinTech / RegTech — AML/CFT Compliance |
| **Type** | Enterprise SaaS (multi-tenant) |
| **Backend** | Go 1.24, PostgreSQL 16 + pgvector, Redis |
| **Frontend** | React 18 + TypeScript, Vite, Tailwind, Recharts |
| **Testing** | Go stdlib (343 test files), Vitest, Playwright (21+ E2E flows) |
| **Deploy** | Render (Docker, 2-10 auto-scaling), GitHub Actions CI/CD |
| **SDKs** | Go, Node.js, Python |

## Architecture

6-layer cascade screening engine:
Exact -> Fuzzy (Jaro-Winkler) -> Phonetic (Soundex/Metaphone) -> Token (Jaccard) -> Embedding (pgvector) -> Graph

Additional optimizations: Bloom filters, BK-tree, TF-IDF, MinHash LSH, Ristretto cache, ensemble scoring.

## Scale

- **Backend**: 160+ API handlers, 150+ screening files, 52 migrations
- **Frontend**: 276 components, 11+ dashboard pages
- **Ingestion**: 25+ sanctions list parsers (OFAC, UN, EU, UK, etc.)
- **Billing**: LemonSqueezy, 5 products x 3 tiers

## Strengths

1. Domain-driven design with rich value objects
2. Multi-algorithm matching with early-exit cascade
3. Sub-10ms fast screening for payment flows
4. Comprehensive audit trail (immutable hash-chained logs)
5. Multi-tenant with per-tenant configuration
6. Strong test coverage (343 Go test files + E2E)
7. Field-level AES-256-GCM encryption for PII
8. SAR/STR report generation for regulators

## Gaps Identified

| Gap | Severity | Notes |
|-----|----------|-------|
| No real-time APM/observability | Medium | Internal metrics exist but no dashboard |
| No 3D entity visualization | Low | Graph matcher exists, no visual output |
| No voice interface | Low | Accessibility opportunity |
| Limited i18n coverage | Medium | Scaffolding present, not complete |
| No offline-first mode | Low | SDKs exist, no local screening |
| No flaky test detection | Medium | Large test suite needs stability checks |
