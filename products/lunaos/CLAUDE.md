# LunaOS — Product CLAUDE Rules

Extends `/Users/shaharsolomon/dev/projects/CLAUDE.md` (portfolio rules).
Cannot weaken any rule there. The pre-migration source CLAUDE.md is
preserved as `CLAUDE.source.md` for historical reference.

## Product mission

AI orchestration and runtime. LunaOS is the substrate that other
FinsavvyAI products (Qestro, OpenSyber, SDLC.cc) and customer agents
execute on: it ships the runtime, the routing layer, the dashboards
(`lunaos-dashboard`, `lunaos-studio`), the engines
(`lunaos-engine`, `luna-agents`), the IDE/editor bridges
(`lunaos-vscode`, `lunaos-intellij`), the marketing surface
(`lunaos-marketing`), the mobile shell (`lunaos-mobile`), the local
vault (`luna-vault`), and the docs (`lunaos-docs`).

## Target user

Two personas:

1. Internal product teams building FinsavvyAI products that need an
   agent runtime + orchestration layer instead of rolling their own.
2. External developer teams who want a unified AI-agent runtime they
   can self-host or consume as a service.

## Product-specific architecture constraints

- `lunaos-engine` is the runtime core. Everything else depends on it;
  it depends on nothing inside this product. Keep it surface-stable.
- `luna-agents` is the agent definition layer. New agent capabilities
  land here, not in engine. Engine evolves slowly, agents evolve fast.
- `lunaos-dashboard` and `lunaos-studio` MUST NOT bypass the engine API.
  No direct DB or state-store access from UI.
- The IDE bridges (`lunaos-vscode`, `lunaos-intellij`) talk to the
  engine over the same public protocol as remote clients — no
  "internal" privileged path.
- `luna-vault` is local-first secrets storage. It is NOT a substitute
  for `@finsavvyai/auth` token handling at the platform boundary.
- The bundled `OpenHands` and `antigravity-awesome-skills` directories
  are vendored upstream code. Treat as read-only; upgrade by re-vendor,
  not by inline edits.

## lunaforge legacy harvest pattern

`lunaforge` is the predecessor product, migrated under `legacy/` per
addendum §3. The harvest rule is:

- New code lands at the LunaOS root only.
- Useful code may be **elevated** from `legacy/` to its proper home
  inside LunaOS over time, with a commit message of the form
  `feat(lunaos): elevate <module> from lunaforge legacy` and a
  reference in this file's "Elevations" section.
- Once a module is elevated, its `legacy/` copy must be replaced with
  a short pointer file (one line) noting the new path.
- `legacy/` is never extended. Bug fixes go to the elevated version
  only.
- After 6 months of zero elevations, `legacy/` is a candidate for
  archive (with a recorded snapshot in `_archive/`).

### Elevations

(none yet — track each here as it lands)

## Product-specific test matrix

Beyond portfolio defaults (>=90% lines, >=85% branches, 100% critical
paths), LunaOS CI must include:

- Engine surface contract tests — every public API has a versioned
  contract test that breaks the build on backward-incompatible change.
- Agent registration/dispatch path = critical (100%).
- Dashboard <-> engine smoke test in CI.
- IDE bridge protocol round-trip test per supported editor.
- Mobile shell smoke build per platform (no full device matrix in CI;
  nightly).
- `luna-vault` round-trip encryption test = critical (100%).

## Product-specific security controls

- Engine refuses any agent execution request without an authenticated
  caller; auth wired through `@finsavvyai/auth` token verify.
- Agent permission grants are deny-by-default. Each capability needs
  an explicit grant; grants are audit-logged through
  `@finsavvyai/telemetry`.
- `luna-vault` uses authenticated encryption only; no plaintext
  fallback path.
- IDE bridges run as the local user; they MUST NOT escalate to
  root-equivalent rights even on user request.
- Critical alerts: `lunaos.engine.auth_failed`,
  `lunaos.vault.decrypt_failed`, `lunaos.agent.permission_denied_spike`.

## Product-specific release checklist

In addition to portfolio Definition of Done:

- [ ] Engine contract tests green; no breaking change without a
      semver-major bump.
- [ ] Dashboard build artifact size diff <= +5% vs previous release.
- [ ] IDE bridges built for current LTS of each editor.
- [ ] Mobile shell builds reproducible.
- [ ] `legacy/` harvest log updated if anything was elevated.

## Open consolidations (handoff)

- LunaOS does not currently import any `@finsavvyai/*` packages at the
  workspace root. Wiring telemetry + policy-engine through the engine
  is open work, out of scope for round 4.
- Cross-product coordination with Qestro: Qestro dashboards explicitly
  borrow LunaOS dashboard patterns (see
  `products/qestro/frontend/src/components/onboarding/`). Any breaking
  redesign should notify the Qestro team.
- `lunaos-mobile`, `lunaos-docs`, `lunaos-intellij`, and `luna-vault`
  were nested git repos in the source; their `.git/` dirs were
  excluded per migration policy. If their history is needed, refer to
  the source repo at `/portfolio/luna-os/`.
