# PipeWarden — Product-Level CLAUDE Rules

This file extends `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio
rules). All portfolio non-negotiables remain in force.

> The original pre-monorepo PipeWarden CLAUDE.md (339 lines) is preserved at
> `CLAUDE.legacy.md`. This file is the current source of truth for the
> monorepo home.

## Mission

PipeWarden is the open-source policy engine and rule scanner that
underpins FinsavvyAI's hosted policy services. It is intentionally OSS
(MIT) to drive adoption and external rule contributions.

Target user: platform/security engineers who need a transparent, auditable
rule engine they can run in their own CI without phoning home.

## Product-specific architecture constraints

- **Go-only core.** No runtime dependency on Node or Python. The web
  surfaces (`functions/`, `workers/`) are deployable side cars, not load
  bearing for policy decisions.
- **Default deny.** Unknown rule types and malformed input return
  `deny: unknown_rule` rather than allow-by-default.
- **Pure decision function.** The policy evaluator must be deterministic
  and side-effect-free. Logging and metrics are emitted by callers, not
  by the evaluator itself.
- **Rule schema stable.** Rule manifests are public contracts. Breaking
  schema changes require a major version bump and a migration script.
- **No remote rule fetch at evaluation time.** Rules are loaded at startup
  from local files or pinned bundles; never fetched mid-decision.
- **Air-gapped build supported.** `.goreleaser.airgap.yml` produces
  artifacts that run with zero outbound network.

## Product-specific test matrix

In addition to portfolio coverage targets (90% lines / 85% branches / 100%
critical paths):

- **Decision determinism**: the evaluator is a critical path; 100% coverage
  required, including fuzz tests on malformed rule input.
- **Rule fixtures**: every shipped rule has a positive fixture (matches +
  expected verdict) and a negative fixture (does not match).
- **Server smoke**: `pipewarden-server` HTTP API has integration tests
  covering health, decision, and admin endpoints.
- **Compatibility matrix**: CI verifies rule files from the most recent
  three minor versions still load without error.

## Product-specific security controls

Beyond portfolio mandatory SAST/dependency/secret/license scans:

- **Vault integration**: secrets accessed via `internal/vault/`; never
  embedded in rule definitions.
- **No `os.Exec` from decision paths**: enforced by code review. Decision
  evaluation must not shell out.
- **Audit log**: each decision emits a structured entry:
  `{ ts, actor_id, event: "policy.decide", resource, decision, reason }`.
  No PII in `reason`.
- **Signed releases**: every published binary signed via `.goreleaser.yml`
  cosign step. Verification command published in release notes.
- **Supply chain**: `go mod verify` in CI; no replace directives in
  release builds.

## Product-specific release checklist

- [ ] Portfolio Definition of Done met
- [ ] All Go platform targets built (linux/darwin/windows × amd64/arm64)
- [ ] Air-gapped variant built and verified offline
- [ ] Rule schema version unchanged OR migration script published
- [ ] `CHANGELOG.md` updated; breaking changes flagged
- [ ] No `Critical` or `High` open in SAST, deps, or secret scans
- [ ] `coverage.out` shows >=90% lines, 100% on `internal/policy/`
- [ ] Hosted `platform/policy-engine/` consumers updated if rule schema
      changed (no orphaned contract)
- [ ] `pipewarden-server /health` returns `{ status: "ok" }` on
      `finsavvy-pipewarden-server-<env>` deploy (round-3 mesh shape)

## OSS contribution posture

- All accepted PRs must add or update a test.
- New rules require a fixture pair (match + non-match) and docs.
- No CLA required at present (CLA placeholder in `CONTRIBUTING.md`).
- Maintainers must respond to CVE reports within 5 business days.

## Notes for AI assistants

- Treat `LICENSE` as immutable. Any change requires explicit human
  approval.
- Do not introduce non-MIT-compatible dependencies. Check `go.mod`
  additions against an SPDX MIT-compatible allowlist.
- The 200-line cap applies to **new** files. Pre-existing oversized files
  (~83 Go files known) are tracked for refactor; do not silently rewrite.
