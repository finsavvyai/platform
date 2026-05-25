# Secure Development Lifecycle

> Required by M365 Cert (control A4).

## Phases

| Phase | Activity | Tooling | Evidence |
|---|---|---|---|
| Plan | threat-model new features | STRIDE template in PR description | linked from PR |
| Code | type-safe, linted, max 200 lines/file | TypeScript strict, ESLint, Prettier | CI |
| Review | mandatory PR review for security-relevant code | GitHub branch protection | PR record |
| Build | reproducible build, no test creds | pnpm + Wrangler | CI |
| Test | unit ≥90% line / ≥85% branch; integration; E2E | Vitest + Playwright | CI artifacts |
| Scan | SAST + dep audit + secret scan + license check | Semgrep, pnpm audit, TruffleHog, license-checker | `.github/workflows/security.yml` |
| Deploy | only via CI / `wrangler deploy` from main | Cloudflare | `wrangler deployments list` |
| Operate | logging, alerts, on-call | Sentry, CF Analytics | runbooks |
| Respond | incident response process | `docs/INCIDENT_RESPONSE.md` | post-mortems |

## Branch protection (main)

- ≥1 review required, dismiss stale reviews on push
- All CI checks required to pass
- Linear history (squash or rebase)
- No force-push, no deletions
- Signed commits — **TODO** enable for compliance

## Dependencies

- Renovate / Dependabot weekly
- `pnpm audit --audit-level=high` in CI fails on High/Critical
- License allow-list: MIT, Apache-2.0, BSD-2/3, ISC, MPL-2.0
- Disallow: GPL family in shipped artifacts

## Secrets handling

- Never in repo (TruffleHog enforced)
- Production secrets via `wrangler secret put`
- Local dev: `.dev.vars` (gitignored)
- Rotation: `JWT_SECRET`, `GRAPH_TOKEN_KEK` rotated every 12 months or on incident

## Code review checklist (security-relevant)

- [ ] Input validated (Zod) at every API boundary
- [ ] Output encoded (no raw HTML in templates without trust justification)
- [ ] Authorization checked: `c.get('user')`, `requireTenant`, role check
- [ ] D1 queries scoped to `organization_id` / `tenant_id`
- [ ] No new Graph scope without entry in `docs/GRAPH_PERMISSIONS.md`
- [ ] No PII logged
- [ ] Audit log written for state-changing actions
- [ ] Rate-limit on auth or expensive endpoints
- [ ] No secrets in code or logs

## Vulnerability triage SLA

See `docs/VULNERABILITY_DISCLOSURE.md` for inbound. Internally discovered:

| Sev | Fix in |
|---|---|
| Critical | 14 days |
| High | 30 days |
| Medium | 60 days |
| Low | 90 days or roadmap |

## Training

- Developers: review OWASP Top 10 + MS-365 Cert checklist annually
- Founders/admins: phishing-resistant MFA, hardware key recommended

## Records

- PR list with security review checkbox: GitHub
- CI run history: GitHub Actions
- Wrangler deployment history: `wrangler deployments list`
- Incident log: `.luna/security-incidents.md` (private)
- Post-mortems: `docs/post-mortems/<date>.md`
- Tabletop notes: `.luna/tabletop/<date>.md` (private)
