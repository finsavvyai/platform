# Coverage Gap (baseline 2026-04-25)

Portfolio target: **≥90% line, ≥85% branch overall** + **100% on critical
paths** (auth, audit, rate_limiter, dlp, opa, billing, security controls,
data writes).

CI thresholds are now wired at the target — every PR fails until tests
close the gap. This file lists *where* to write tests, in priority order.

## Measured baseline

| Service | Lines | Branches | Status |
| --- | ---: | ---: | --- |
| gateway (Go) | **11.2%** | n/a | FAIL — 78.8% gap to close |
| admin-ui (Jest) | **10.05%** | **7.0%** | FAIL — 79.95% / 78% gap |
| document-processor (Jest) | TBD | TBD | jest.config.js newly added; baseline measured in next CI run |
| rag (pytest) | TBD | TBD | pytest.ini_options newly added; baseline measured in next CI run |
| vector-core (cargo-llvm-cov) | TBD | n/a | wired in coverage.yml; baseline measured in next CI run |

## Gateway — top zero-coverage packages (priority order)

| Package | LOC | Why | Owner |
| --- | ---: | --- | --- |
| `internal/policy` | ~600 | OPA policy engine — critical security path | TBD |
| `internal/infrastructure/security` | ~400 | credential manager, IP blocker | TBD |
| `internal/interfaces/http/handlers` | ~2000 | every HTTP handler | TBD |
| `internal/infrastructure/repositories` | ~600 | tenant + audit DB writes | TBD |
| `internal/infrastructure/storage` | ~300 | object storage abstraction | TBD |
| `internal/interfaces/http/routes` | ~150 | route wiring | TBD |
| `cmd/server/claw_store.go` | ~700 | RAG/audit/document storage adapter | TBD |

Already covered (≥50%):

- `internal/interfaces/http/swagger`: 83%
- `internal/infrastructure/scim`: 69%
- `internal/interfaces/http/middleware`: 54%
- `tests/integration` (the test files themselves): 52%

## Admin-UI — top zero-coverage packages (priority order)

From the Jest coverage table:

- `src/auth/` — 0% (critical path, MUST hit 100%)
- `src/lib/security/` — 0% (critical path)
- `src/lib/api-enhancer.ts` — 0%
- `src/store/user-management/{tenant-actions,user-actions}.ts` — ~3-5%
- `src/utils/security/{audit-logger,crypto,encryption,validation}.ts` — 0%
- `src/utils/performance/monitor.ts` — 0%

## RAG — expected gap

The 27 files excluded from ruff (listed in `pyproject.toml` `[tool.ruff]`
`exclude` block) are also untested. Each is a candidate for test-first
rewrite.

## How to close the gap

The coverage-writing work is interleaved into the roadmap:

- **Phase 1**: each new feature day adds tests for that feature. Coverage
  rises organically as Phase 1 ships.
- **Critical-path packages** (`auth`, `audit`, `rate_limiter`, `policy`,
  `dlp`, `security/credential_manager`, `security/ip_blocker`) get
  dedicated test-writing days inserted at Phase 1 boundaries when their
  baseline is below 100%.

If a single PR cannot land without breaking CI on coverage, the engineer
should cite this document and an issue ticket in the PR description, and
ratchet the threshold for that package only with sign-off.

## Do not

- Lower the global threshold below the portfolio target.
- Add files to `collectCoverageFrom` ignore lists to "fix" the percent.
- Use `// istanbul ignore` or `// nocov` without a code comment explaining
  why and a tracking issue.

The gap is real. We close it by writing tests, not by hiding it.
