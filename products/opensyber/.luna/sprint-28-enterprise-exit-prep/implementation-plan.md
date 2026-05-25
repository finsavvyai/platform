# Sprint 28: Enterprise Exit Prep — Implementation Plan

**Status**: Complete (all core phases done)
**Tests**: 1,140 passing (102 test files) + 61 shared tests
**Typecheck**: Clean

## Phase 1: OpenAPI & SCIM Foundation
- [x] 1.1 Create OpenAPI spec info (`routes/openapi/spec-info.ts`)
- [x] 1.2 Create OpenAPI spec paths (`routes/openapi/spec-paths.ts`)
- [x] 1.3 Create OpenAPI route (`routes/openapi/index.ts`)
- [x] 1.4 Create SCIM types (`services/scim/types.ts`)
- [x] 1.5 Create SCIM user routes (`routes/scim-users.ts`)
- [x] 1.6 Create SCIM group routes (`routes/scim-groups.ts`)
- [x] 1.7 Register OpenAPI + SCIM routes in `register.ts`
- [x] 1.8 Create OpenAPI route test (5 tests)
- [x] 1.9 Create SCIM user route tests (6 tests)
- [x] 1.10 Create SCIM group route tests (4 tests)

## Phase 2: SOC2 Type 1 Controls
- [x] 2.1 Create SOC2 control mapping constants (`packages/shared/src/constants/soc2.ts`)
- [x] 2.2 SOC2 readiness uses existing OASF assessment tables (no new migration needed)
- [x] 2.3 SOC2 evidence collection integrated into readiness route
- [x] 2.4 Create SOC2 readiness API routes (`routes/soc2-readiness.ts`)
- [x] 2.5 Create SOC2 route tests (4 tests)

## Phase 3: SLA Monitoring
- [x] 3.1 SLA aggregation integrated into monitoring route
- [x] 3.2 Create SLA monitoring API routes (`routes/sla-monitoring.ts`)
- [x] 3.3 Create SLA route tests (4 tests)

## Phase 4: Data Room (Series A)
- [x] 4.1 Create data room admin API routes (`routes/data-room.ts`)
- [x] 4.2 Create data room route tests (3 tests)

## Phase 5: Frontend Pages
- [x] 5.1 Create SOC2 + SLA proxy routes (web)
- [x] 5.2 Create SOC2 readiness dashboard page
- [x] 5.3 Create SLA monitoring dashboard page
- [x] 5.4 Add sidebar links for SOC2 + SLA pages

## Phase 6: Permissions & Validation
- [x] 6.1 Add 5 new permissions (scim.read, scim.write, sla.view, sla.export, dataroom.view) — total 49
- [x] 6.2 Update permissions tests
- [x] 6.3 Typecheck + test + build validation
