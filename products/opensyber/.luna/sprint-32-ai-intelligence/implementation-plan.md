# Sprint 32: AI Intelligence Layer — Implementation Plan

## Phase 1: Schema
- [x] 1.1 AI insights table schema
- [x] 1.2 AI recommendations table schema
- [x] 1.3 AI query history table schema
- [x] 1.4 Migration SQL (0018)

## Phase 2: Services
- [x] 2.1 NL query translator (pattern-based activity search)
- [x] 2.2 Auto-triage classifier (threat vs normal activity)
- [x] 2.3 Compliance narrative generator (OASF report text)
- [x] 2.4 Service tests (20 tests)

## Phase 3: API Routes
- [x] 3.1 NL query endpoint (POST /api/ai/query)
- [x] 3.2 Auto-triage endpoints (POST /api/ai/triage, /triage/batch)
- [x] 3.3 AI insights CRUD (GET/POST/PATCH /api/ai/insights)
- [x] 3.4 Compliance narrative endpoint (POST /api/ai/compliance-narrative)
- [x] 3.5 Route tests (9 tests)
- [x] 3.6 Register routes

## Phase 4: Validation
- [x] 4.1 Typecheck clean
- [x] 4.2 All Sprint 32 tests pass
