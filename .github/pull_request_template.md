<!-- FinsavvyAI Platform — Pull Request -->

## Summary
<!-- 1-3 sentences. What changed and why. Link the issue / spec. -->

Closes #

## Change type
- [ ] feat (new user-visible capability)
- [ ] fix (bug fix)
- [ ] refactor (no behavior change)
- [ ] perf
- [ ] docs
- [ ] chore / build / ci
- [ ] security
- [ ] breaking change

## Testing checklist
- [ ] Unit tests added/updated (Vitest, colocated `*.test.ts`)
- [ ] Integration tests pass (`pnpm -r test`)
- [ ] Smoke / synthetic probe still green for affected services
- [ ] Coverage thresholds met (lines >= 90%, branches >= 85%, functions >= 90%)
- [ ] Critical-path code (auth, billing, policy, audit) at 100% coverage
- [ ] Bug fix? Includes a failing test that now passes

## Security checklist
- [ ] No secrets, tokens, or PII committed (gitleaks must pass)
- [ ] `pnpm audit --prod --audit-level=high` clean (no Critical/High)
- [ ] Inputs validated at boundaries (no `eval`, dynamic `require`, or request-path `child_process`)
- [ ] Constant-time comparisons for HMAC / token equality where applicable
- [ ] Audit log emitted for auth events, admin actions, sensitive mutations
- [ ] Stable error codes preserved (no breaking renames)

## Breaking changes
<!-- If checked above: describe the break, the consumer impact, and the migration steps. Otherwise: "None." -->

## Screenshots / recordings (UI changes)
<!-- Before / after. Include accessibility check (contrast, keyboard focus, screen reader labels). Apple HIG alignment. -->

## Rollback plan
<!-- How to revert this change safely.
     - revert PR + redeploy previous version, OR
     - wrangler versions deploy --percentage 0 to the new version, OR
     - feature flag off
     Include any data migration concerns. -->

## Cross-package / cross-agent impact
- [ ] Touches package boundaries (`@finsavvyai/*` imports added or removed)
- [ ] Changes a public API surface (errors, types, audit shape, webhook verifier)
- [ ] Requires coordination with: <!-- list agents/owners -->

## Definition of Done
- [ ] CI green (typecheck, test, coverage, audit, secret-scan)
- [ ] Code owner review complete
- [ ] Docs / changelog updated
- [ ] Monitoring + rollback path validated
