# Sprint 27: Marketplace + Skill Ecosystem -- Implementation Plan

**Scope**: OpenSyber / Sprint 27 Marketplace + Skill Ecosystem
**Generated**: 2026-03-07
**Status**: Core Complete (SDK + Schema + API + Frontend)
**Tests**: 1,152 tests across 100 test files

## Completion Summary

- [x] Phase 1: Skill SDK package (`@opensyber/skill-sdk`) — types, defineSkill, testing utilities, 38 tests
- [x] Phase 1: Database schema (`marketplace.ts`) — 5 new tables + skills ALTER
- [x] Phase 1: Migration `0015_marketplace.sql`
- [x] Phase 1: Permissions — marketplace.browse, .install, .publish, .admin (44 total permissions)
- [x] Phase 2: Marketplace Browse API — GET /marketplace (search/filter), /featured, /:id
- [x] Phase 2: Marketplace Install API — POST/DELETE /:id/install, GET /installed
- [x] Phase 2: Marketplace Rate API — POST /:id/rate, GET /:id/ratings
- [x] Phase 2: Marketplace Publish API — POST /publish, GET/PATCH /my-skills
- [x] Phase 2: Marketplace Admin API — GET /submissions, PATCH /submissions/:id, PATCH /skills/:id/featured
- [x] Phase 2: Route registration + 22 marketplace API tests
- [x] Phase 3: Proxy routes — /api/proxy/marketplace (list + detail)
- [x] Phase 3: Marketplace browse page + sidebar navigation
- [ ] Phase 4: First-party skills (cursor-monitor, secret-vault-bridge, siem-forwarder) — deferred
- [ ] Phase 4: Skill executor + scheduler — deferred

---

*Original detailed plan below:*

---

## Phase 1: SDK + Schema Foundation (Days 1-3)

### Task 1.1: Skill SDK Package Setup (Day 1, 0.5d)

- [ ] 1.1.1 Create `packages/skill-sdk/` directory structure
- [ ] 1.1.2 Create `packages/skill-sdk/package.json` (`@opensyber/skill-sdk`, version 0.1.0)
- [ ] 1.1.3 Create `packages/skill-sdk/tsconfig.json`
- [ ] 1.1.4 Create `packages/skill-sdk/vitest.config.ts`
- [ ] 1.1.5 Add `packages/skill-sdk` to `pnpm-workspace.yaml`

**Files created**: 4 config files

### Task 1.2: Skill SDK Core Types (Day 1, 1d)

- [ ] 1.2.1 Create `packages/skill-sdk/src/types.ts` -- SkillProfile, SkillContext, SkillEmitter, SkillLogger, VaultClient, HttpClient interfaces (<200 lines)
- [ ] 1.2.2 Create `packages/skill-sdk/src/outputs.ts` -- CspmFindingInput, SaasFindingInput, RiskDeltaInput, AssetRelationInput, EvidenceInput, RemediationInput, MetricInput (<200 lines)
- [ ] 1.2.3 Create `packages/skill-sdk/src/targets.ts` -- TargetType, SkillTarget, ResolvedTarget (<60 lines)
- [ ] 1.2.4 Create `packages/skill-sdk/src/define.ts` -- defineSkill() helper with runtime validation (<50 lines)
- [ ] 1.2.5 Create `packages/skill-sdk/src/logger.ts` -- SkillLogger default implementation (<40 lines)
- [ ] 1.2.6 Create `packages/skill-sdk/src/index.ts` -- barrel export

**Files created**: 6 source files
**Tests**: Task 1.3

### Task 1.3: Skill SDK Testing Utilities + Tests (Day 2, 0.5d)

- [ ] 1.3.1 Create `packages/skill-sdk/src/testing.ts` -- createMockContext(), CapturedOutputs (<150 lines)
- [ ] 1.3.2 Create `packages/skill-sdk/src/runner.ts` -- LocalSkillRunner class (<100 lines)
- [ ] 1.3.3 Create `packages/skill-sdk/src/define.test.ts` -- test defineSkill() validation
- [ ] 1.3.4 Create `packages/skill-sdk/src/testing.test.ts` -- test mock context captures
- [ ] 1.3.5 Create `packages/skill-sdk/src/runner.test.ts` -- test local runner execution

**Files created**: 5 files (2 source + 3 tests)
**Coverage target**: 100% for SDK

### Task 1.4: Database Migration (Day 2, 0.5d)

- [ ] 1.4.1 Create `packages/db/migrations/0014_marketplace.sql` -- ALTER skills table + CREATE 6 new tables + indexes
- [ ] 1.4.2 Update `packages/db/src/schema/instances.ts` -- add new columns to skills table definition (itemType, tier, priceCents, metadata, manifest, bundleR2Key, sdkVersion, publisherId, license, homepage, repository, tags, screenshots, isFeatured, isCertified)
- [ ] 1.4.3 Create `packages/db/src/schema/marketplace.ts` -- Drizzle schema for skillVersions, marketplaceSubmissions, marketplaceInstalls, marketplaceRatings, skillExecutions, publisherPayouts (<200 lines)
- [ ] 1.4.4 Update `packages/db/src/schema/index.ts` -- add `export * from './marketplace.js'`
- [ ] 1.4.5 Run `pnpm db:generate` to verify migration

**Files created/modified**: 1 migration, 1 new schema, 2 modified

### Task 1.5: Permissions + Plan Config (Day 2, 0.5d)

- [ ] 1.5.1 Update `packages/shared/src/constants/permissions.ts` -- add marketplace.browse, marketplace.install, marketplace.publish, marketplace.admin
- [ ] 1.5.2 Update `packages/shared/src/constants/permissions.ts` -- add marketplace.browse to VIEW_PERMISSIONS, other perms to appropriate roles
- [ ] 1.5.3 Update `packages/shared/src/constants/plans.ts` -- add marketplaceInstallLimit to PlanConfig (free: 3, personal: 5, pro: 10, team: null)
- [ ] 1.5.4 Create `packages/shared/src/constants/permissions.test.ts` -- verify new permissions in role sets (update existing test file)

**Files modified**: 3 files

### Task 1.6: Zod Validation Schemas (Day 3, 0.5d)

- [ ] 1.6.1 Create `apps/api/src/routes/marketplace-schemas.ts` -- browseQuerySchema, installBodySchema, rateBodySchema, updateSkillBodySchema, adminReviewBodySchema, manifestSchema (<200 lines)
- [ ] 1.6.2 Create `apps/api/src/routes/marketplace-schemas.test.ts` -- test all schemas with valid/invalid inputs

**Files created**: 2 files

---

## Phase 2: API Routes + Services (Days 3-6)

### Task 2.1: Marketplace Browse API (Day 3, 0.5d)

- [ ] 2.1.1 Create `apps/api/src/routes/marketplace-browse.ts` -- GET /api/marketplace (list + search + filter + paginate), GET /api/marketplace/:id (detail), GET /api/marketplace/:id/versions (<200 lines)
- [ ] 2.1.2 Create `apps/api/src/routes/marketplace-browse.test.ts` -- test browse, search, filter, pagination, detail, 404

**Files created**: 2 files

### Task 2.2: Marketplace Install API (Day 4, 1d)

- [ ] 2.2.1 Create `apps/api/src/routes/marketplace-install.ts` -- POST /api/marketplace/:id/install, DELETE /api/marketplace/:id/install, GET /api/marketplace/installed, PATCH /api/marketplace/installed/:installId/config (<200 lines)
- [ ] 2.2.2 Create `apps/api/src/services/marketplace-plan-check.ts` -- canInstallSkill() plan tier + limit validation (<80 lines)
- [ ] 2.2.3 Create `apps/api/src/services/marketplace-plan-check.test.ts` -- test all plan tiers and limits
- [ ] 2.2.4 Create `apps/api/src/routes/marketplace-install.test.ts` -- test install, uninstall, plan enforcement, RBAC

**Files created**: 4 files

### Task 2.3: Marketplace Rating API (Day 4, 0.5d)

- [ ] 2.3.1 Create `apps/api/src/routes/marketplace-rate.ts` -- POST /api/marketplace/:id/rate (create/update rating, recalculate skill aggregate) (<120 lines)
- [ ] 2.3.2 Create `apps/api/src/routes/marketplace-rate.test.ts` -- test create, update, aggregate recalculation

**Files created**: 2 files

### Task 2.4: Skill Scanner Service (Day 5, 0.5d)

- [ ] 2.4.1 Create `apps/api/src/services/skill-scanner.ts` -- scanSkillBundle() with pattern matching rules, ScanResult, ScanFinding types (<150 lines)
- [ ] 2.4.2 Create `apps/api/src/services/skill-scanner.test.ts` -- test each scan rule with clean + flagged inputs

**Files created**: 2 files

### Task 2.5: Marketplace Publish API (Day 5, 1d)

- [ ] 2.5.1 Create `apps/api/src/services/skill-package-validator.ts` -- validatePackage() extracts tar.gz, validates manifest, checks hash integrity (<150 lines)
- [ ] 2.5.2 Create `apps/api/src/services/skill-package-validator.test.ts`
- [ ] 2.5.3 Create `apps/api/src/routes/marketplace-publish.ts` -- POST /api/marketplace/publish (upload, validate, store in R2, create records), GET /api/marketplace/my-skills, PATCH /api/marketplace/my-skills/:id, POST /api/marketplace/my-skills/:id/versions (<200 lines)
- [ ] 2.5.4 Create `apps/api/src/routes/marketplace-publish.test.ts` -- test publish flow, validation errors, my-skills CRUD

**Files created**: 4 files

### Task 2.6: Marketplace Admin API (Day 6, 0.5d)

- [ ] 2.6.1 Create `apps/api/src/routes/marketplace-admin.ts` -- GET /api/admin/marketplace/submissions, PATCH /api/admin/marketplace/submissions/:id (approve/reject), PATCH /api/admin/marketplace/skills/:id/featured (<150 lines)
- [ ] 2.6.2 Create `apps/api/src/routes/marketplace-admin.test.ts` -- test submission review, featured toggle, RBAC

**Files created**: 2 files

### Task 2.7: Skill Executor Service (Day 6, 0.5d)

- [ ] 2.7.1 Create `apps/api/src/services/skill-executor.ts` -- SkillExecutor class with execute(), output validation, timeout handling (<200 lines)
- [ ] 2.7.2 Create `apps/api/src/services/skill-executor.test.ts` -- test execution, output routing, timeout, retry

**Files created**: 2 files

### Task 2.8: Route Registration (Day 6, 0.25d)

- [ ] 2.8.1 Update `apps/api/src/routes/register.ts` -- import and register all marketplace routes
- [ ] 2.8.2 Update `apps/api/src/index.ts` -- add marketplace rate limiting rule
- [ ] 2.8.3 Update `apps/api/src/index.ts` -- add skill scheduler to scheduled() handler

**Files modified**: 2 files

---

## Phase 3: Frontend (Days 6-9)

### Task 3.1: Proxy Routes (Day 7, 0.5d)

- [ ] 3.1.1 Create `apps/web/src/app/api/proxy/marketplace/route.ts` -- GET proxy for browse
- [ ] 3.1.2 Create `apps/web/src/app/api/proxy/marketplace/[id]/route.ts` -- GET proxy for detail
- [ ] 3.1.3 Create `apps/web/src/app/api/proxy/marketplace/[id]/install/route.ts` -- POST/DELETE proxy
- [ ] 3.1.4 Create `apps/web/src/app/api/proxy/marketplace/[id]/rate/route.ts` -- POST proxy
- [ ] 3.1.5 Create `apps/web/src/app/api/proxy/marketplace/publish/route.ts` -- POST proxy
- [ ] 3.1.6 Create `apps/web/src/app/api/proxy/marketplace/my-skills/route.ts` -- GET/PATCH proxy
- [ ] 3.1.7 Create `apps/web/src/app/api/proxy/marketplace/installed/route.ts` -- GET proxy

**Files created**: 7 proxy routes

### Task 3.2: Marketplace Browse Page (Day 7, 1d)

- [ ] 3.2.1 Create `apps/web/src/app/dashboard/marketplace/page.tsx` -- server component, fetch featured + initial page
- [ ] 3.2.2 Create `apps/web/src/app/dashboard/marketplace/MarketplaceGrid.tsx` -- client component, skill card grid with infinite scroll (<200 lines)
- [ ] 3.2.3 Create `apps/web/src/app/dashboard/marketplace/MarketplaceFilters.tsx` -- client component, category/tier/sort filters (<150 lines)
- [ ] 3.2.4 Create `apps/web/src/app/dashboard/marketplace/SkillCard.tsx` -- client component, individual skill card with tier badge, rating, install count (<120 lines)
- [ ] 3.2.5 Create `apps/web/src/app/dashboard/marketplace/types.ts` -- SkillListItem, MarketplaceFilters interfaces

**Files created**: 5 files

### Task 3.3: Skill Detail Page (Day 8, 1d)

- [ ] 3.3.1 Create `apps/web/src/app/dashboard/marketplace/[id]/page.tsx` -- server component, fetch skill detail
- [ ] 3.3.2 Create `apps/web/src/app/dashboard/marketplace/[id]/SkillDetail.tsx` -- client component, full detail view with tabs (Overview, Versions, Config) (<200 lines)
- [ ] 3.3.3 Create `apps/web/src/app/dashboard/marketplace/[id]/InstallButton.tsx` -- client component, install/uninstall with loading state (<100 lines)
- [ ] 3.3.4 Create `apps/web/src/app/dashboard/marketplace/[id]/RatingStars.tsx` -- client component, interactive rating input + display (<100 lines)

**Files created**: 4 files

### Task 3.4: Publish + My Skills Pages (Day 8-9, 1d)

- [ ] 3.4.1 Create `apps/web/src/app/dashboard/marketplace/publish/page.tsx` -- server component
- [ ] 3.4.2 Create `apps/web/src/app/dashboard/marketplace/publish/PublishWizard.tsx` -- client component, 4-step wizard (upload, preview, pricing, submit) (<200 lines)
- [ ] 3.4.3 Create `apps/web/src/app/dashboard/marketplace/my-skills/page.tsx` -- server component
- [ ] 3.4.4 Create `apps/web/src/app/dashboard/marketplace/my-skills/MySkillsList.tsx` -- client component, published skills list with status, ratings, revenue (<150 lines)

**Files created**: 4 files

### Task 3.5: Installed Skills Management (Day 9, 0.5d)

- [ ] 3.5.1 Create `apps/web/src/app/dashboard/marketplace/installed/page.tsx` -- server component
- [ ] 3.5.2 Create `apps/web/src/app/dashboard/marketplace/installed/InstalledSkillsList.tsx` -- client component, installed skills with enable/disable toggle, config, uninstall (<150 lines)
- [ ] 3.5.3 Create `apps/web/src/app/dashboard/marketplace/installed/SkillConfigPanel.tsx` -- client component, JSON config editor (<100 lines)

**Files created**: 3 files

### Task 3.6: Navigation Integration (Day 9, 0.25d)

- [ ] 3.6.1 Update `apps/web/src/app/dashboard/layout.tsx` -- add Marketplace link to sidebar navigation
- [ ] 3.6.2 Update `apps/web/src/components/SiteHeader.tsx` -- add Marketplace to top nav if needed

**Files modified**: 2 files

---

## Phase 4: First-Party Skills + Integration (Days 9-12)

### Task 4.1: cursor-monitor Skill (Day 10, 1d)

- [ ] 4.1.1 Create `packages/skills/cursor-monitor/src/index.ts` -- defineSkill() with SkillProfile for Cursor-specific telemetry (<150 lines)
- [ ] 4.1.2 Create `packages/skills/cursor-monitor/src/parsers.ts` -- parse Cursor telemetry data (file edits, completions, context windows) (<150 lines)
- [ ] 4.1.3 Create `packages/skills/cursor-monitor/src/index.test.ts` -- test with MockSkillContext
- [ ] 4.1.4 Create `packages/skills/cursor-monitor/package.json`
- [ ] 4.1.5 Create `packages/skills/cursor-monitor/manifest.json`

**Files created**: 5 files

### Task 4.2: secret-vault-bridge Skill (Day 10, 0.5d)

- [ ] 4.2.1 Create `packages/skills/secret-vault-bridge/src/index.ts` -- defineSkill() for HashiCorp Vault / AWS Secrets Manager bridge (<150 lines)
- [ ] 4.2.2 Create `packages/skills/secret-vault-bridge/src/providers/hashicorp.ts` -- Vault API client (<100 lines)
- [ ] 4.2.3 Create `packages/skills/secret-vault-bridge/src/providers/aws-sm.ts` -- AWS Secrets Manager client (<100 lines)
- [ ] 4.2.4 Create `packages/skills/secret-vault-bridge/src/index.test.ts`
- [ ] 4.2.5 Create `packages/skills/secret-vault-bridge/package.json`
- [ ] 4.2.6 Create `packages/skills/secret-vault-bridge/manifest.json`

**Files created**: 6 files

### Task 4.3: siem-forwarder Skill (Day 11, 0.5d)

- [ ] 4.3.1 Create `packages/skills/siem-forwarder/src/index.ts` -- defineSkill() for SIEM event forwarding (<150 lines)
- [ ] 4.3.2 Create `packages/skills/siem-forwarder/src/providers/splunk.ts` -- Splunk HEC client (<80 lines)
- [ ] 4.3.3 Create `packages/skills/siem-forwarder/src/providers/datadog.ts` -- Datadog API client (<80 lines)
- [ ] 4.3.4 Create `packages/skills/siem-forwarder/src/providers/elastic.ts` -- Elasticsearch client (<80 lines)
- [ ] 4.3.5 Create `packages/skills/siem-forwarder/src/index.test.ts`
- [ ] 4.3.6 Create `packages/skills/siem-forwarder/package.json`
- [ ] 4.3.7 Create `packages/skills/siem-forwarder/manifest.json`

**Files created**: 7 files

### Task 4.4: Skill Scheduler Integration (Day 11, 0.5d)

- [ ] 4.4.1 Create `apps/api/src/services/skill-scheduler.ts` -- runScheduledSkills() queries active installs, matches cron schedules, queues execution (<150 lines)
- [ ] 4.4.2 Create `apps/api/src/services/skill-scheduler.test.ts` -- test scheduling logic
- [ ] 4.4.3 Update `apps/api/src/services/cron-handlers.ts` -- add runScheduledSkills to cron handler

**Files created**: 2 new, 1 modified

### Task 4.5: Marketplace Seeding (Day 11, 0.5d)

- [ ] 4.5.1 Create `apps/api/src/services/marketplace-seed.ts` -- seed function to insert 3 first-party skills with approved status, featured flag (<150 lines)
- [ ] 4.5.2 Create seed script or migration addendum for initial skill data

**Files created**: 1-2 files

### Task 4.6: End-to-End Testing (Day 12, 1d)

- [ ] 4.6.1 Test full publish flow: create skill package, upload, validate, security scan, approve
- [ ] 4.6.2 Test full install flow: browse marketplace, install skill, verify plan check, verify config
- [ ] 4.6.3 Test full execute flow: installed skill runs on schedule, outputs persisted, execution logged
- [ ] 4.6.4 Test rating flow: rate skill, update rating, verify aggregates
- [ ] 4.6.5 Test uninstall flow: uninstall skill, verify cleanup
- [ ] 4.6.6 Run `pnpm typecheck && pnpm test` across entire monorepo

---

## Summary

| Phase | Days | Tasks | Files Created | Files Modified |
|---|---|---|---|---|
| 1: SDK + Schema | 3 | 23 | ~18 | ~6 |
| 2: API Routes | 3 | 18 | ~18 | ~2 |
| 3: Frontend | 3 | 18 | ~23 | ~2 |
| 4: Skills + Integration | 3 | 19 | ~24 | ~2 |
| **Total** | **12** | **78** | **~83** | **~12** |

### Critical Path

```
Day 1-2:  SDK types + testing utilities (blocks everything)
Day 2:    Migration + permissions (blocks API routes)
Day 3:    Zod schemas + browse API (blocks frontend)
Day 4-5:  Install/publish/rate APIs (blocks install UI)
Day 6:    Executor + scheduler (blocks skill runtime)
Day 7-9:  Frontend pages (blocks first-party skill testing)
Day 10-11: First-party skills (blocks success gates)
Day 12:   E2E testing + polish
```

### Risk Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| R2 multipart upload complexity | Blocks publish flow | Use simple PUT with body limit; chunked upload in Phase 2 |
| Dynamic import() in Workers | May not support arbitrary bundles | Fallback: store skill logic as serialized config, not executable code |
| LemonSqueezy per-skill variants | Requires manual variant creation | Automate via LS API; fallback to manual for Phase 1 (3 skills only) |
| tar.gz extraction in Worker | CPU-intensive for large packages | Use streaming decompression; enforce 10MB limit |
| Skill execution timeout | Worker has 30s limit on free plan | Use Cloudflare Queues for async execution; Durable Objects for long-running |

### Definition of Done

- [ ] `@opensyber/skill-sdk` package exports all types + defineSkill + MockSkillContext
- [ ] Migration `0014_marketplace.sql` applied successfully
- [ ] All 5 marketplace API route groups have tests with >80% coverage
- [ ] Marketplace browse page renders with search, filter, pagination
- [ ] Skill detail page shows full skill info with install button
- [ ] Publish wizard accepts .opensyber-skill files and creates submissions
- [ ] 3 first-party skills published and installable
- [ ] Skill executor runs installed skills and persists outputs
- [ ] RBAC enforced on all marketplace routes
- [ ] Plan limits enforced on skill installs
- [ ] `pnpm typecheck && pnpm test` passes across entire monorepo
