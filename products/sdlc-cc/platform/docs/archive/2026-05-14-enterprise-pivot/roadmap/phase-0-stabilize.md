# Phase 0 — Stabilize (Days 1-5)

Goal: end the week with every service green in CI, coverage thresholds
enforced, gosec at 0 in source, and a clean baseline metrics dashboard.

---

### Day 1 — Triage and commit pending work

**Goal:** stash or commit every uncommitted change in the working tree,
reach a clean `git status`, tag the baseline.

**Why:** the repo currently has 60+ modified files across services from
prior sessions. Without a clean baseline, every day after this one is
muddy.

**Files to touch:** all modified files under `services/`, `packages/`,
`landing-page/`. Do not delete `.luna/` reports — they are evidence.

**Steps:**
1. `git status --short | grep -v "^??"` — list every tracked modification.
2. For each cluster (gateway middleware, document-processor excel,
   shared-billing, vector-core, rag fixes), inspect the diff and decide:
   commit if intentional, revert if accidental.
3. Group commits by service + theme. Suggested boundaries:
   - `chore(gateway): wire Phase-2 middleware chain (router.go, chain.go)`
   - `fix(document-processor): excel processor type drift`
   - `chore(packages): bump shared-billing/dashboard dependencies`
   - `refactor(rag): chunking + migrator + office_extractors stabilization`
   - `chore(vector-core): regex dep + minor cleanups`
4. Tag the cleaned state: `git tag baseline-phase-0`.

**Tests:** none — pure commit hygiene.

**Verify:**
```bash
git status --short
git log --oneline | head -10
git tag --list | grep baseline
```

**Done when:** `git status --short` is empty (or only intentional
untracked files), and `baseline-phase-0` tag exists on `main`.

**Prompt:**
> The sdlc-platform working tree has accumulated uncommitted changes from
> several prior sessions. Read `git status --short` and `git diff --stat`
> for each modified directory under `services/`, `packages/`, and
> `landing-page/`. Group changes into logical commits (one per service per
> theme) and commit them. Do NOT commit `.gitignore`'d files or untracked
> binaries. After commits land, tag the result `baseline-phase-0`. Stop
> and ask before reverting anything that looks like real work.

---

### Day 2 — Coverage thresholds enforced in CI

**Goal:** every service fails its CI job if coverage drops below the
portfolio thresholds (≥90% line, ≥85% branch overall; 100% on
auth/permissions/data writes).

**Why:** tests pass today but coverage isn't gated, so regressions don't
fail PRs.

**Files to touch:**
- `services/gateway/Makefile` (add `-coverpkg`, `-covermode=atomic`,
  fail on threshold).
- `services/admin-ui/jest.config.js` (`coverageThreshold` block).
- `services/rag/pyproject.toml` or `.coveragerc` (`fail_under = 90`).
- `services/document-processor/jest.config.js` (`coverageThreshold`).
- `services/vector-core/Cargo.toml` + `.github/workflows/ci.yml`
  (cargo-llvm-cov + grcov fail-under).
- `.github/workflows/ci.yml` (run coverage step per service, upload to
  artifact, fail on miss).

**Steps:**
1. Wire each service's coverage command behind `make test-coverage` /
   `npm run test:coverage` / `pytest --cov` / `cargo llvm-cov`.
2. Add threshold config in each service's tooling (don't rely on CI
   regex on coverage output).
3. Add a `.github/workflows/coverage.yml` that runs all 4 service
   coverage jobs in parallel and fails if any reports below 90/85.
4. Mark critical-path packages (auth, audit, rate_limiter, dlp, opa)
   for 100% coverage explicitly via `coverPkg` or `--include` filters.

**Tests:** intentionally introduce one untested branch in `auth.go`
locally and confirm CI fails. Revert.

**Verify:**
```bash
cd services/gateway && make test-coverage
cd services/admin-ui && npm run test:coverage
cd services/rag && pytest --cov=app --cov-fail-under=90
cd services/vector-core && cargo llvm-cov --fail-under-lines 90
gh workflow run coverage.yml --ref $(git rev-parse --abbrev-ref HEAD)
```

**Done when:** all four jobs pass green AND fail when coverage is forced
below threshold.

**Prompt:**
> Add coverage enforcement to sdlc-platform CI. For each service
> (`services/gateway`, `services/admin-ui`, `services/rag`,
> `services/document-processor`, `services/vector-core`) add a coverage
> command and a fail-under threshold of 90% line / 85% branch. Mark
> critical-path packages (auth, audit, rate_limiter, dlp, opa, billing)
> as 100%. Wire `.github/workflows/coverage.yml` to run all jobs in
> parallel and fail PRs that miss thresholds. Do NOT lower the
> thresholds to make existing code pass — instead, list the packages
> below threshold and stop, so a human can prioritize the gaps.

---

### Day 3 — RAG service Python 3.11 baseline + dependency hygiene

**Goal:** RAG tests run on Python 3.11 in CI with `pgvector.sqlalchemy`
installed; pytest collects all 15+ test files without import errors.

**Why:** RAG is currently blocked on Python 3.9 (Xcode default) and a
missing `pgvector.sqlalchemy` import. Until this clears, no integration
test can exercise the RAG path.

**Files to touch:**
- `services/rag/pyproject.toml` or `requirements.txt`
- `services/rag/Dockerfile` (pin python:3.11-slim base)
- `.github/workflows/ci.yml` (matrix: 3.11 only, pin)
- `services/rag/tests/conftest.py` (real pgvector fixture)

**Steps:**
1. Pin Python ≥3.11 in `pyproject.toml` (`python = "^3.11"`).
2. Add `pgvector` and `pgvector[sqlalchemy]` to dependencies.
3. Update `Dockerfile` base image and CI matrix.
4. Replace any `from sqlalchemy import Vector` (wrong) with
   `from pgvector.sqlalchemy import Vector`.
5. Add a `testcontainers-python` postgres+pgvector fixture for
   integration tests.

**Tests:**
- `pytest --collect-only` returns no collection errors.
- `pytest -m "not integration"` runs and passes.
- One smoke integration test `test_pgvector_roundtrip.py` inserts +
  queries one embedding via the testcontainer.

**Verify:**
```bash
cd services/rag
python --version              # 3.11.x
pytest --collect-only -q
pytest -m "not integration"
pytest tests/test_pgvector_roundtrip.py
```

**Done when:** all three commands above succeed locally and in CI.

**Prompt:**
> The sdlc-platform RAG service (`services/rag`) currently fails to
> collect tests on Python 3.9 because of a missing `pgvector.sqlalchemy`
> import and walrus-operator syntax that requires 3.11+. Pin Python to
> ^3.11 in `pyproject.toml`, add `pgvector[sqlalchemy]` to dependencies,
> update the Dockerfile base image to `python:3.11-slim`, and add a
> `testcontainers-python` Postgres+pgvector fixture for integration
> tests. Add one smoke test that inserts and queries an embedding
> through the real pgvector binding. Update `.github/workflows/ci.yml`
> RAG matrix to 3.11 only.

---

### Day 4 — Observability baseline (Prometheus + Grafana + Sentry)

**Goal:** every service exports Prometheus metrics on `/metrics`, sends
errors to Sentry, and has a Grafana dashboard JSON committed to repo.

**Why:** before adding features, we need to see what's happening. No
"production ready" path skips observability.

**Files to touch:**
- `services/gateway/internal/infrastructure/observability/prometheus_metrics.go`
  (already exists — verify and extend).
- `services/rag/app/observability/prometheus.py` (new).
- `services/document-processor/src/observability/prometheus.ts` (new).
- `services/admin-ui/src/lib/observability/sentry.ts` (init).
- `deployments/grafana/dashboards/{gateway,rag,document-processor,admin-ui}.json`

**Steps:**
1. Each service: add a `/metrics` endpoint behind a separate HTTP listener
   (Go: separate `http.Server`; Python: `prometheus_client` ASGI mount;
   Node: `prom-client` middleware).
2. Standard metrics per service: request counter, latency histogram,
   in-flight gauge, panic counter, dependency-call latency.
3. Sentry SDK init for all services with `traces_sample_rate=0.1`.
4. Commit Grafana dashboard JSON exports under
   `deployments/grafana/dashboards/`.
5. Add a docker-compose override `docker-compose.observability.yml` that
   spins Prometheus + Grafana + Sentry-self-hosted for local dev.

**Tests:**
- `curl :9090/metrics` returns Prometheus exposition format with
  `service_name="gateway"` (and similar for RAG, DP).
- A forced panic results in a Sentry issue (verify in dev env).

**Verify:**
```bash
docker compose -f deployments/docker-compose.observability.yml up -d
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
# expect 4
curl http://localhost:3001/api/dashboards/uid/gateway-overview
```

**Done when:** all 4 service targets report `up` in Prometheus and the
gateway dashboard renders without errors.

**Prompt:**
> Add Prometheus metrics + Sentry error reporting to all four sdlc-platform
> services (`gateway`, `rag`, `document-processor`, `admin-ui`). Each
> backend service exposes `/metrics` on a separate HTTP listener with
> standard Go/Python/Node metrics + custom counters for auth events, RAG
> queries, and document uploads. Commit Grafana dashboard JSON exports for
> each service under `deployments/grafana/dashboards/`. Add a
> `docker-compose.observability.yml` for local dev. Sentry SDK init in
> each service reads DSN from env. Do NOT hardcode any DSN.

---

### Day 5 — Security baseline gate in CI

**Goal:** PRs fail on any new gosec HIGH, npm audit Critical/High,
Trivy Critical, or unresolved CVE in `pip-audit`.

**Why:** we just landed gosec=0; need to keep it that way.

**Files to touch:**
- `.github/workflows/security.yml` (new or extend)
- `services/gateway/.gosec.json` (config: severity=HIGH gates)
- `services/rag/pyproject.toml` (pip-audit config)
- `services/admin-ui/package.json` (`audit-ci` script)

**Steps:**
1. Add `.github/workflows/security.yml` with parallel jobs for gosec,
   npm audit, pip-audit, cargo audit, Trivy.
2. Each job fails on Critical or High; warns on Medium; ignores Low.
3. Allowlist file `security/allowlist.yml` for documented exceptions
   (must include CVE id, justification, expiry date).
4. Add a make target `security-scan` that runs all four locally.
5. Wire pre-push hook (`.husky/pre-push` or `lefthook.yml`) to run gosec
   + npm audit on changed services only.

**Tests:**
- Inject a known-vulnerable dep (e.g., `lodash@4.17.0`) on a feature
  branch; confirm CI fails.
- Add a CVE allowlist entry; confirm CI passes.
- Revert the bad dep.

**Verify:**
```bash
make -C services/gateway security-scan
gh workflow run security.yml --ref $(git rev-parse --abbrev-ref HEAD)
```

**Done when:** all 5 scanners run on every PR and fail on any new HIGH+.

**Prompt:**
> Add a security baseline workflow to sdlc-platform. Create
> `.github/workflows/security.yml` with parallel jobs for gosec (Go),
> npm audit (admin-ui + document-processor), pip-audit (RAG),
> cargo audit (vector-core), and Trivy (containers). Fail on Critical or
> High; warn on Medium. Add an allowlist file `security/allowlist.yml`
> requiring CVE id, justification, and expiry per entry. Add a
> `security-scan` Make target per service. Wire a pre-push hook that
> runs the relevant scanners on changed services only. Do NOT skip a
> finding without an allowlist entry.

---

End of Phase 0. Tag: `phase-0-complete`. Expected state: all services
green, coverage gated, observability online, security scans enforcing.
