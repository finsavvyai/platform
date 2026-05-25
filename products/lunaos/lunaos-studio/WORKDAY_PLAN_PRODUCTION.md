# LunaOS Studio Production Workday Plan

Date: 2026-03-04
Target: polish and launch-hardening in 10 working days

## Known Gaps (current)
- Governance baseline partially missing and now added.
- Deploy workflow includes placeholder smoke test step.
- Cloudflare deployment hardening needs explicit rollback and monitoring gates.

## Day-by-Day
1. Day 1
- Lock release scope and target URL strategy.
- Confirm production environment variables and secrets ownership.
2. Day 2
- Enforce CI checks (`lint`, `test`, `build`) as required branch gates.
- Verify CODEOWNERS review rules.
3. Day 3
- Replace deploy smoke-test placeholder with executable checks.
- Add synthetic uptime checks for primary routes.
4. Day 4
- Validate Cloudflare deploy and rollback sequence.
- Document cache purge and version rollback procedure.
5. Day 5
- Define frontend SLOs (availability, LCP, error rate).
- Connect alerts to operator channel.
6. Day 6
- Stabilize cross-browser and visual regression suite.
- Remove or quarantine flaky tests with owner + SLA.
7. Day 7
- Run rollback drill during low-traffic window.
- Confirm session/auth continuity after rollback.
8. Day 8
- Run Lighthouse and performance budget enforcement.
- Set fail thresholds in CI.
9. Day 9
- Finalize deployment runbook and troubleshooting guide.
- Validate handover checklist for operations.
10. Day 10
- Launch readiness signoff and controlled rollout.
- Monitor 24h with incident response standby.

## Definition of Done
- No deploy placeholders remain.
- Smoke + synthetic checks are live.
- Rollback tested successfully.
- Performance budgets enforced in CI.
