# PushCI — Product-Level CLAUDE Rules

This file extends `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio rules).
All portfolio non-negotiables remain in force. Stricter rules below; no
weakening of any portfolio rule is permitted.

> The original pre-monorepo PushCI CLAUDE.md (742 lines) is preserved at
> `CLAUDE.legacy.md` for historical reference. The current source of truth is
> this file plus the portfolio CLAUDE.md it extends.

## Mission

PushCI is the developer-adoption wedge for the FinsavvyAI platform: an
AI-native CI/CD that runs locally inside developer machines and AI agent
sandboxes (Claude, Cursor, Windsurf). Zero config, zero cost, full
parity with hosted CI. It is the entry point through which developers
discover the rest of the platform (Qestro, OpenSyber, SDLC.cc).

Target user: solo developers and small teams adopting AI coding agents who
need fast feedback loops without paying for hosted CI minutes.

## Product-specific architecture constraints

PushCI is a **CI/CD security wedge**, not a general-purpose runner:

- The CLI ships as a single Go binary per OS/arch. No runtime download of
  arbitrary scripts. Plugins are statically registered.
- Local execution model. No data leaves the developer machine unless the
  user opts in to telemetry or remote artifact upload.
- Tailscale mesh is the only supported peer-to-peer transport for distributed
  jobs. No alternate inbound listener.
- The TS/Node API (`api/`) is a Cloudflare Worker for the SaaS upgrade path;
  the binary CLI never depends on it for core CI execution.
- Mobile (`mobile/`) is an Expo/React Native control surface only — it does
  not execute jobs.
- Extensions (`extensions/cursor/`, `extensions/vscode/`) embed the CLI; they
  do not re-implement it.

## Product-specific test matrix

In addition to the portfolio coverage targets (90% lines / 85% branches /
100% critical paths), PushCI requires:

- **CLI smoke**: every supported OS/arch binary executes `pushci --version`
  and `pushci init --dry-run` in CI before any release tag is pushed.
- **Stack matrix**: integration tests cover the language/framework grid
  documented in `CAPABILITIES.md` (33 languages, 40+ frameworks, 22 deploy
  targets). New stacks require a new test fixture under
  `tests/e2e/testdata/stacks/`.
- **Sandbox parity**: behaviour inside an AI agent sandbox (no network,
  reduced filesystem) must match host execution for the documented core
  commands.
- **Secrets path**: the `pushci secrets` family is a critical path; 100%
  coverage including failure modes (missing keyring, denied keyring access,
  malformed secret).
- **Plan-check / governance**: `pushci plan` and `pushci check` are
  critical paths; 100% coverage including policy denial reasons.

## Product-specific security controls

Beyond portfolio mandatory SAST/dependency/secret/license scans:

- **Supply chain**: every released binary is signed (cosign or platform
  equivalent) and the signature published alongside the artifact. `.goreleaser.yml`
  governs the pipeline; changes require security review.
- **Keyring**: secrets stored via `zalando/go-keyring`. Never write secrets to
  disk in cleartext. Constant-time comparison for any user-supplied token.
- **No `child_process` from request paths in the TS api**: enforced by lint
  rule; violation blocks merge.
- **Default-deny posture**: undefined steps in a buildspec do not execute.
  Unknown commands fail closed with a clear error.
- **Audit log**: every `pushci plan`, `pushci deploy`, `pushci secrets *`
  emits a structured audit entry: `{ ts, actor_id, event, resource, decision, reason }`.
- **Network egress**: the CLI must list every domain it contacts in
  `docs/network.md`. CI checks the list against actual egress in the test sandbox.

## Product-specific release checklist

A release is shippable only when **all** of the following are true:

- [ ] Portfolio Definition of Done met
- [ ] All supported OS/arch binaries built, signed, and smoke-tested
- [ ] `CHANGELOG.md` updated with user-facing changes
- [ ] `CAPABILITIES.md` updated if any stack/framework support changed
- [ ] Homebrew formula (`Formula/`) bumped if release is public
- [ ] npm package version bumped and `prepack` script verified
- [ ] No `Critical` or `High` open in SAST, deps, or secret scans
- [ ] `docs/network.md` reviewed against actual telemetry endpoints
- [ ] Rollback path validated: previous version installable via
      `npm install -g pushci@<prev>` and the binary boots
- [ ] Monitoring confirms `finsavvy-pushci-api-<env>` health endpoint returns
      `{ status: "ok" }` post-deploy (round-3 mesh health shape)

## Cross-product wedge contract

PushCI's value to the rest of the platform is the **upgrade path**: a user
who adopts the CLI should encounter low-friction transitions to Qestro
(runtime QA), OpenSyber (runtime AI security), and SDLC.cc (governance).
The CLI MUST NOT degrade the local experience to force these upgrades.
Cross-sells are surfaced as opt-in commands, never as mandatory steps.

## Notes for AI assistants

- Do not create new top-level directories in `products/pushci/` without
  documenting the rationale in `MIGRATION_NOTES.md`.
- The 200-line cap applies to **new** files. Pre-existing oversized files
  (~71 known) are tracked for refactor; do not silently rewrite them as
  part of an unrelated task.
- Coverage delta on PRs must be reported in the PR description.
