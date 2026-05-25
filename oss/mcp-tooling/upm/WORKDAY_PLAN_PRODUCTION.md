# UPM Production Workday Plan

Date: 2026-03-04
Target: production stabilization in 10 working days

## Known Gaps (current)
- Governance baseline was missing and has been added.
- Multiple CI workflows exist; required path needs consolidation.
- Runtime and deployment parity across Python backend and Node frontend needs explicit contract.

## Day-by-Day
1. Day 1
- Choose single authoritative CI workflow path.
- Freeze environments (dev/staging/prod) and dependency policy.
2. Day 2
- Enforce backend + frontend test gates as required checks.
- Add fail-fast thresholds for lint/type/test failures.
3. Day 3
- Validate Trivy/CodeQL output triage flow.
- Add secret scanning and dependency policy enforcement.
4. Day 4
- Validate Docker image provenance and immutable tags.
- Test staging deployment flow with rollback step.
5. Day 5
- Add API SLO dashboards and DB health alerting.
- Verify Celery queue and worker backlog alarms.
6. Day 6
- Expand integration tests for auth, billing, and plugin lifecycle.
- Add smoke suite against staging URL.
7. Day 7
- Perform controlled rollback exercise.
- Document rollback prerequisites and expected downtime.
8. Day 8
- Run performance test baseline and size bottlenecks.
- Set scaling policy and budgets.
9. Day 9
- Finalize operator runbooks and incident matrix.
- Verify security disclosure flow from `SECURITY.md`.
10. Day 10
- Conduct production readiness review and signoff.
- Promote release with 24h enhanced monitoring.

## Definition of Done
- CI path is unambiguous and enforced.
- Staging deployment + rollback proven.
- SLO dashboards and alerts live.
- Production checklist signed.
