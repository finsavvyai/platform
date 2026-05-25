# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in PushCI, please report it responsibly.

**Email:** security@pushci.dev

**Do not** open a public GitHub issue for security vulnerabilities.

## Response Timeline

- **Acknowledgment:** within 48 hours
- **Triage and initial assessment:** within 5 business days
- **Fix for Critical/High severity:** within 7 days of confirmation
- **Fix for Medium/Low severity:** within 30 days of confirmation

## Scope

The following are in scope for security reports:

- PushCI CLI (`cmd/pushci/`, `internal/`)
- PushCI API (`api/src/`)
- PushCI Dashboard (`web/dashboard/`)
- PushCI MCP Server (`internal/mcp/`)
- Secrets management (`internal/secrets/`)
- Authentication and authorization flows

## Out of Scope

- Social engineering attacks
- Denial of service (DoS/DDoS)
- Issues in third-party dependencies (report upstream; notify us if it affects PushCI)
- Issues requiring physical access to a user's machine
- Findings from automated scanners without a demonstrated impact

## Security Measures

PushCI employs the following security controls:

- **Secrets encryption:** AES-256-GCM with machine-bound keys
- **CI scanning:** gitleaks, govulncheck, gosec, golangci-lint
- **API auth:** OAuth (GitHub, GitLab, Google, Microsoft, LinkedIn) + JWT
- **Enterprise:** SAML, SCIM, MFA, RBAC, immutable audit chain, SIEM export
- **SSRF protection:** Channel bridge URLs are SSRF-guarded

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.7.x   | Yes       |
| < 1.7   | No        |

## Recognition

We credit reporters in release notes (unless you prefer anonymity).

## Past Disclosures

### 2026-05-16 — MCP registry credentials committed to repo history

**Summary.** Two files used by the MCP registry publishing flow —
`.mcpregistry_github_token` (a short-lived GitHub OAuth user
token, `ghu_*`) and `.mcpregistry_registry_token` (a registry JWT
scoped to `io.github.finsavvyai/*`) — were committed to this
repository on 2026-04-08 (commit `e1602ae`) and remained in the
working tree until removed on 2026-05-16.

**Impact at disclosure time.**

- The registry JWT had an `exp` claim of `1775548970` (Sat
  2026-03-28 14:42 UTC) — already expired 49 days before
  discovery. Inert.
- The `ghu_*` GitHub user token is by GitHub's design a
  short-lived OAuth-flow credential; presumed expired (current
  active `gh auth` for this repo uses a long-lived `gho_*`
  token, unaffected).
- The repository is private; the history was not exposed to the
  public internet. No public mirrors. No fork chain.
- Both tokens scoped to `finsavvyai` (publish on `io.github.finsavvyai/*`)
  — no customer data, no production infrastructure, no AWS/GCP
  keys, no Stripe/Lemon Squeezy keys involved.

**Remediation.**

- Added both filenames to `.gitignore`.
- Removed both files from the working tree and the index.
- This disclosure section.

**Decision: history not scrubbed.** The acceptance criteria
on the related issue offered scrub-via-`git filter-repo` *or*
accept-exposure-with-revoked-tokens. We chose the latter because
both tokens were already inert at the time of discovery, the
repo is private, and a force-push to `main` carries higher blast
radius than the residual risk of expired credentials in history.

A future credential leak with non-trivial residual blast radius
should re-evaluate and use `git filter-repo --invert-paths --path
<file>` followed by a coordinated force-push.
