# Production Scope and Required Checks

**Purpose:** Freeze production scope, map CI jobs to branch protection, and document security gates.  
**Plans:** [WORKDAY_PLAN_PRODUCTION.md](../WORKDAY_PLAN_PRODUCTION.md) (Days 1–2)

---

## 1. Critical Services (Production Scope)

| Service | Repo Path | Deployment Target | In Scope |
|---------|-----------|-------------------|----------|
| **Gateway** | `services/gateway` | Kubernetes / Cloudflare | Yes |
| **RAG** | `services/rag` | Kubernetes / Cloudflare | Yes |
| **Landing Page** | `landing-page` | Cloudflare Pages | Yes |
| **Admin UI** | `services/admin-ui` | Cloudflare Pages / K8s | Yes |
| **LAM / Workers** | `services/lam-*.js`, `services/gateway-worker` | Cloudflare Workers | Yes |
| **Vector Core** | `services/vector-core` | Optional (Rust) | If built |
| **DLP** | `services/dlp` | Kubernetes | Yes |
| **LLM Gateway** | `services/llm-gateway` | Kubernetes | Yes |
| **OPA** | `services/opa` | Kubernetes | Yes |

**Frozen for launch:** Gateway, RAG, Landing Page, Admin UI, LAM/Workers. Other services are in scope when their pipelines are enabled.

---

## 2. Required Status Checks → Branch Protection

Branch protection for `main` **must** require the following status checks.  
GitHub shows the **job name** (first line of `name:`) as the check name.

### From workflow: `CI/CD Pipeline` (`.github/workflows/ci.yml`)

| Required Check (use in Branch Protection) | Job Name in ci.yml |
|-------------------------------------------|---------------------|
| Lint Gateway (Go) | `lint-gateway` → "Lint Gateway (Go)" |
| Lint RAG Service (Python) | `lint-rag` → "Lint RAG Service (Python)" |
| Lint Landing Page (Node) | `lint-landing-page` → "Lint Landing Page (Node)" |
| Test Gateway (Go) | `test-gateway` → "Test Gateway (Go)" |
| Test RAG Service (Python) | `test-rag` → "Test RAG Service (Python)" |
| Test Landing Page (Node) | `test-landing-page` → "Test Landing Page (Node)" |
| SAST - Static Application Security Testing | `sast` |
| Dependency Vulnerability Scan | `dependency-scan` |
| Secret Detection | `secret-scan` |
| Quality Gate | `quality-gate` |

**Note:** If your repo uses a single “CI” workflow with one combined job, add that job name instead. The list above matches the current `ci.yml` job names.

### From workflow: `Security & Dependency Scanning` (`.github/workflows/security-scan.yml`)

Use only if this workflow is enabled and runs on `main`/PRs. Job names: e.g. "Go Vulnerability Check", "Secret Detection", etc. Add the exact names from the workflow as required checks for `main`.

### Recommendation

1. In **Settings → Branches → Branch protection rule for `main`**:
2. Enable **Require status checks to pass before merging**.
3. Add at least: **Quality Gate**, **Lint Gateway (Go)**, **Test Gateway (Go)**, **Lint RAG Service (Python)**, **Test RAG Service (Python)**, **Lint Landing Page (Node)**, **Test Landing Page (Node)**, **SAST - Static Application Security Testing**, **Dependency Vulnerability Scan**, **Secret Detection** (exact names as shown in the Actions tab).
4. Enable **Require branches to be up to date before merging** (strict).

---

## 3. CODEOWNERS and Approvals

- **CODEOWNERS location:** `CODEOWNERS` (root) and `.github/CODEOWNERS`.
- **Current rule:** `* @shaharsolomon`; `.github/` and `security/` require code owner review.
- **Branch protection:** For `main`, enable **Require review from Code Owners** and set **Required approving reviews** (e.g. 2) per [WORKDAY_PLAN_PRODUCTION.md](../WORKDAY_PLAN_PRODUCTION.md) and [.github/branch-protection.yml](../.github/branch-protection.yml).

---

## 4. Critical Vulnerability Gate

- **Rule:** No merge to `main` when **Critical** or **High** vulnerabilities are present.
- **Implementation:**
  - In **CI/CD Pipeline** (`.github/workflows/ci.yml`):
    - **Dependency Vulnerability Scan** (Trivy): runs with `severity: 'CRITICAL,HIGH'` and **must** use `exit-code: '1'` so the job fails when such vulnerabilities exist.
    - **Quality Gate** job: must fail if `dependency-scan` or `sast` or `secret-scan` fails (already depends on these; ensure failure propagation).
  - In **Security & Dependency Scanning** (`.github/workflows/security-scan.yml`): container scan already uses `exit-code: '1'` for CRITICAL,HIGH. Keep it; ensure this workflow is required for `main` if it runs on PRs.

**Definition of Done (security):** Zero Critical/High in main; required checks enforced and passing.

---

*Last updated: 2026-03-06. Align with [WORKDAY_PLAN_PRODUCTION.md](../WORKDAY_PLAN_PRODUCTION.md) and [.github/workflows/ci.yml](../.github/workflows/ci.yml).*
