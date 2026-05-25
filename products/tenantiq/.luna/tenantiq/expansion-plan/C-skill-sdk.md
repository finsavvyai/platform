# Phase C — Skill SDK + External Marketplace

**Goal:** Ecosystem moat. External developers publish skills. Rev-share creates flywheel competitors can't match.

**Effort:** 2.5 weeks (12-13 working days). Solo eng. Legal review separate.

## Verified Current State

| File | LOC | Notes |
|------|-----|-------|
| `apps/api/src/routes/tenants/skills-routes.ts` | 70 | per-tenant skill state |
| `apps/api/src/routes/tenants/skills-data.ts` | 76 | skill listing |
| `apps/api/src/lib/marketplace-config.ts` | 81 | static skill catalog (internal) |
| `apps/api/src/middleware/skill-gate.ts` | — | `requireSkill('copilot')` middleware |
| `apps/web/src/routes/skills/+page.svelte` | — | hub page |
| `apps/web/src/lib/components/skills/{SkillCard,SkillGate,SkillRecommendation}.svelte` | — | UI components |
| `packages/` | — | NO `skill-sdk` package exists |
| `apps/api/src/lib/lemonsqueezy.ts` | — | billing webhook handlers exist |

## Honest Gaps

1. **No SDK package** — `marketplace-config.ts` is hardcoded internal catalog. No external publish path.
2. **No manifest schema** — skill definitions are TS objects, no JSON Schema for external authoring.
3. **No sandbox runner** — current "skills" are just feature flags + prebuilt code paths. No isolated execution per-skill.
4. **No submission/review flow** — no GitHub integration, no CI validation pipeline.
5. **No rev-share infra** — LemonSqueezy webhook exists for tenant billing, not contributor payout split.
6. **No skill versioning** — no version pinning, no rollback per tenant.

## Tasks (atomic commits)

### C1 — `@tenantiq/skill-sdk` package (3d)
- [ ] C1.1 Create `packages/skill-sdk/` workspace package, exports types only initially
- [ ] C1.2 `packages/skill-sdk/src/manifest-schema.ts` — Zod schema: `id, version, name, description, author, scopes (Graph perms), inputs[], outputs[], runtime ('worker'|'edge'), entrypoint (URL), priceModel, rollbackSupported`
- [ ] C1.3 `packages/skill-sdk/src/runner-contract.ts` — TypeScript interface every skill must implement: `validate(input)`, `execute(ctx, input)`, `rollback?(ctx, executionId)`
- [ ] C1.4 `packages/skill-sdk/src/context.ts` — `SkillContext` interface: scoped Graph token getter, KV ns, logger, abort signal
- [ ] C1.5 `packages/skill-sdk/src/result-types.ts` — `SkillResult<T>` discriminated union (success/error/partial)
- [ ] C1.6 Manifest validator + JSON Schema export for external authoring (`pnpm dlx @tenantiq/skill-sdk init`)
- [ ] C1.7 README w/ quickstart, sample skill, how to test locally

**Commit:** `feat(skill-sdk): manifest schema + runner contract package`

### C2 — Sandbox runner (3d)
- [ ] C2.1 `apps/api/src/lib/skills/runner.ts` — fetch skill bundle from R2 by version, validate manifest, instantiate isolated `Worker` context (Cloudflare service binding pattern)
- [ ] C2.2 Token scoping: mint short-lived Graph token w/ ONLY scopes declared in manifest (verify against tenant grants)
- [ ] C2.3 Rate limiting per-skill per-tenant via KV (max executions/hour from manifest)
- [ ] C2.4 Execution logging: `skill_executions(id, tenant_id, skill_id, version, status, started_at, finished_at, input_hash, output_summary, error)` — migration `0018_skill_executions.sql`
- [ ] C2.5 Rollback API: if manifest declares `rollbackSupported`, call `rollback(executionId)` w/ saved input
- [ ] C2.6 Unit tests: scope-violation rejected, rate limit enforced, rollback round-trip

**Commit:** `feat(skills): sandbox runner with scoped Graph tokens and execution log`

### C3 — Marketplace API + submission flow (3d)
- [ ] C3.1 Migration `0019_skill_marketplace.sql` — `marketplace_skills(id, slug, owner_user_id, latest_version, description, author_payout_method, status (draft|review|published|deprecated), created_at)` + `marketplace_skill_versions(id, skill_id, version, manifest_json, bundle_r2_key, published_at, signed_by, sha256)`
- [ ] C3.2 Route `apps/api/src/routes/marketplace/submit.ts` — POST manifest + bundle → R2 upload → status='review'
- [ ] C3.3 GitHub webhook receiver `apps/api/src/routes/marketplace/github-webhook.ts` — repo dispatch on tagged release auto-submits
- [ ] C3.4 Admin review API `apps/api/src/routes/admin/marketplace-review.ts` — approve/reject (manual MVP; automated CI later)
- [ ] C3.5 Public catalog `GET /api/marketplace/skills` — published only, paginated, search
- [ ] C3.6 Per-tenant install/uninstall `POST /api/marketplace/skills/:id/install` — wires into existing `tenants/skills-routes.ts`
- [ ] C3.7 Unit + integration tests

**Commit:** `feat(marketplace): submission, catalog, install API`

### C4 — Marketplace UI (2d)
- [ ] C4.1 `apps/web/src/routes/skills/marketplace/+page.svelte` — browse published skills (cards w/ author, price, install count, scopes)
- [ ] C4.2 `apps/web/src/routes/skills/marketplace/[slug]/+page.svelte` — skill detail page: README, scopes, reviews stub, install button
- [ ] C4.3 `apps/web/src/routes/skills/installed/+page.svelte` — tenant's installed skills, version pin selector, uninstall
- [ ] C4.4 `apps/web/src/routes/dev/publish/+page.svelte` — author dashboard: my skills, drafts, payout settings, install metrics
- [ ] C4.5 Component tests
- [ ] C4.6 Apple HIG pass: focus states, keyboard nav, contrast

**Commit:** `feat(web): marketplace browse, install, author dashboards`

### C5 — Rev-share via LemonSqueezy (2d)
- [ ] C5.1 LemonSqueezy: configure variant per skill (manual setup via API)
- [ ] C5.2 Migration `0020_skill_payouts.sql` — `skill_payouts(id, author_user_id, skill_id, period_start, period_end, gross_cents, platform_fee_cents, net_cents, status, ls_payout_id)`
- [ ] C5.3 Cron monthly: aggregate `skill_executions` × manifest price → compute payouts (70/30 split) → call LS payout API
- [ ] C5.4 Author payout view in `/dev/publish` (read-only, last 6 periods)
- [ ] C5.5 Unit tests for split math, edge cases (refunds, partial month, zero-execution skills)

**Commit:** `feat(marketplace): monthly rev-share payouts via LemonSqueezy`

### C6 — Sample external skill + quickstart docs (1d)
- [ ] C6.1 New repo `tenantiq-skills-samples` (separate, not in monorepo) w/ "guest-cleanup" sample
- [ ] C6.2 Doc: `.luna/tenantiq/skill-sdk-quickstart.md` — clone sample → modify → publish in <30min
- [ ] C6.3 Verify dogfooding: install own sample on staging tenant, run, confirm payout dry-run

**Commit:** `docs(skill-sdk): external developer quickstart + sample skill repo`

## Acceptance Gates

- [ ] External dev creates skill from scratch, publishes via PR/webhook, installs on staging tenant, runs, sees execution log w/ scoped tokens — all in <2hr first-time
- [ ] Sandbox prevents skill from accessing Graph scopes not in manifest (negative test passes)
- [ ] Rate limit blocks 11th call when manifest sets max=10/hr
- [ ] Rollback restores prior state for at least one declared-rollback-supported skill (e.g., revoke license)
- [ ] Monthly payout dry-run produces correct 70/30 split for 5 sample executions

## Risks / Unknowns

- **Cloudflare Worker isolation depth** — service bindings give per-Worker isolation but shared CPU. May need Worker-for-Platforms for true tenant isolation if scaling beyond ~50 concurrent skills. Document as future-work, not Phase C blocker.
- **Legal: marketplace T&C** — contributor liability, IP ownership, payout taxation. **Engineering blocked by legal review** — start parallel with C1.
- **LemonSqueezy payout API quirks** — currency conversion + tax forms (W-9/W-8BEN) for international authors. Budget 2d unplanned for tax form upload flow.
- **Bundle size** — skills shipped as JS bundles in R2; need build pipeline. MVP: trust author-uploaded bundle (signed checksum); future: build-on-publish.
- **Security review of submitted skills** — manual MVP; doesn't scale. Need static analysis tool by ~50 published skills.

## NOT In Scope

- Worker-for-Platforms migration (future phase, scale-driven)
- Automated security scanning of submissions (manual review for v1)
- Skill marketplace search/recommendations ML (basic full-text only)
- Multi-currency payouts beyond LemonSqueezy supported set
- In-marketplace direct messaging between authors and tenants
- Skill A/B testing per-tenant (defer)

## Files Touched (Concrete)

```
NEW:
  packages/skill-sdk/{package.json,tsconfig.json,README.md}
  packages/skill-sdk/src/{manifest-schema,runner-contract,context,result-types,index}.ts
  packages/db/migrations/0018_skill_executions.sql
  packages/db/migrations/0019_skill_marketplace.sql
  packages/db/migrations/0020_skill_payouts.sql
  apps/api/src/lib/skills/runner.ts
  apps/api/src/lib/skills/scope-validator.ts
  apps/api/src/lib/skills/payout-calculator.ts
  apps/api/src/routes/marketplace/{submit,github-webhook,catalog,install}.ts
  apps/api/src/routes/admin/marketplace-review.ts
  apps/api/src/cron/skill-payouts-monthly.ts
  apps/web/src/routes/skills/marketplace/+page.svelte
  apps/web/src/routes/skills/marketplace/[slug]/+page.svelte
  apps/web/src/routes/skills/installed/+page.svelte
  apps/web/src/routes/dev/publish/+page.svelte
  .luna/tenantiq/skill-sdk-quickstart.md

MODIFIED:
  apps/api/src/routes/tenants/skills-routes.ts (wire to marketplace_skills)
  apps/api/src/lib/marketplace-config.ts (delete; replaced by DB-backed catalog)
  apps/api/wrangler.toml (add cron 0 0 1 * * for monthly payout)
  apps/api/src/index.ts (mount new routes)
```
