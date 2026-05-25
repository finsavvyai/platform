# Secret Scanning and Dependency Update Policy

**Purpose:** How to run secret scans (including full history) and how dependency updates are managed.  
**Plans:** [WORKDAY_PLAN_PRODUCTION.md](../WORKDAY_PLAN_PRODUCTION.md) (Day 3)

---

## 1. Secret Scanning

### In CI (PR and push)

- **Workflow:** `.github/workflows/ci.yml`  
  **Job:** `secret-scan` (TruffleHog, verified secrets only).
- **Workflow:** `.github/workflows/security-scan.yml`  
  **Job:** `secret-scan` (Gitleaks, full repo; SARIF uploaded).

Both run on PRs and relevant branches; failures block the quality gate (ci.yml).

### Full-history secret scan (CI and local)

- **Scheduled + manual:** Workflow `.github/workflows/secret-scan-full-history.yml` runs Gitleaks with full git history weekly (Sunday 02:00 UTC) and on `workflow_dispatch`. Results are uploaded as SARIF to the Security tab.

Run locally before launch and after any suspected leak:

```bash
# From repo root
# Option A: Gitleaks (detect only; report path optional)
gitleaks detect --source=. --no-git --report-path=gitleaks-report.json --verbose

# Option B: Full git history (clone with full history first)
gitleaks detect --source=. --report-format=sarif --report-path=gitleaks.sarif --verbose
```

**If using Docker:**

```bash
docker run -v "$(pwd):/path" zricethezav/gitleaks:latest detect --source=/path --report-path=/path/gitleaks.sarif --verbose
```

**If any secret is found:**

1. Rotate the credential immediately (API keys, tokens, passwords).
2. Remove or redact the secret from history (e.g. `git filter-repo` or BFG; coordinate with team).
3. Re-run the scan until clean.
4. Document the incident and rotation in your security runbook.

---

## 2. Dependency Update Policy

### Dependabot

- **Config:** `.github/dependabot.yml`
- **Ecosystems:** github-actions (root), npm (root), pip (services/dlp, packages/sdk-py).
- **Schedule:** Weekly for all.
- **PR rules (recommended):** In **Settings → General → Pull Requests**, consider:
  - Require status checks to pass for Dependabot PRs (same as main).
  - Require at least one approval for dependency changes in security-sensitive paths.
  - Auto-merge only when “Require status checks” and “Require up to date” are satisfied.

### Adding more ecosystems

To cover all critical production services, Dependabot is extended for:

- **Go:** `services/gateway`, (and other Go modules if any).
- **npm:** `landing-page`, `services/admin-ui`, `services/gateway-worker`, etc. (see `.github/dependabot.yml`).
- **pip:** `services/rag`, `services/embedding`, `services/dlp`, `packages/sdk-py`.

See `.github/dependabot.yml` for the exact directories.

### Manual dependency updates

- **Go:** `go get -u ./...` in the module; run tests and security scan.
- **Node:** `npm update` or `npm audit fix` in each package; run lint and tests.
- **Python:** `pip install -U -r requirements.txt` (prefer in a venv); run tests and `pip-audit`.

**Rule:** No merge with unresolved **Critical** or **High** vulnerabilities (enforced by CI).

---

*Last updated: 2026-03-06. Align with [WORKDAY_PLAN_PRODUCTION.md](../WORKDAY_PLAN_PRODUCTION.md) and [.github/dependabot.yml](../.github/dependabot.yml).*
