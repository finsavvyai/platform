# AutomationHub Production Workday Plan

Date: 2026-03-04
Target: service hardening and operational readiness in 10 working days

## Known Gaps (current)
- Governance baseline was missing and has been added.
- Multi-surface stack (frontend/backend/openclaw/cloudflare) needs one release control plane.
- Risk of scope creep from vendored ecosystems without strict support matrix.

## Day-by-Day
1. Day 1
- Define supported production surfaces and de-scope experimental modules.
- Freeze release train and ownership matrix.
2. Day 2
- Enforce CI gates per supported surface.
- Establish CODEOWNERS coverage for critical directories.
3. Day 3
- Enable vulnerability triage workflow and SLA tracking.
- Run secret scanning and rotate exposed credentials if found.
4. Day 4
- Validate deployment strategy for backend + frontend + worker surfaces.
- Add post-deploy health checks and auto-rollback trigger.
5. Day 5
- Build unified observability dashboard (API latency, errors, queue depth).
- Add alert routing and escalation policy.
6. Day 6
- Stabilize integration tests across OpenClaw gateway paths.
- Add smoke tests for channel connection paths.
7. Day 7
- Execute rollback and failover drills.
- Document incident commander workflow.
8. Day 8
- Run load tests for key chat/channel workflows.
- Define horizontal scaling thresholds.
9. Day 9
- Finalize runbooks, SOPs, and support playbooks.
- Confirm on-call readiness and pager hygiene.
10. Day 10
- Production readiness review with evidence pack.
- Controlled rollout with live monitoring.

## Definition of Done
- Supported scope is explicit and enforced.
- Unified deployment and rollback tested.
- Alerts/SLOs operational.
- Production evidence pack complete.
