# Migration Status Check — 2026-05-25

Re-checked after the user asked me to look across `portfolio/` and the broader projects folder. Significant progress has happened. **The migration is much further along than the addendum's "weeks 1-8 plan" implied** — products and OSS have largely been copied into the monorepo skeleton, and 35 archive snapshots are in place. But five things need founder attention before the migration finalizes.

---

## What I can see

Three folders are mounted and accessible:

- `/Users/shaharsolomon/dev/projects/portfolio/` — original source-of-truth
- `/Users/shaharsolomon/dev/projects/finsavvyai-platform/` — target monorepo (where migration is landing)
- `/Users/shaharsolomon/dev/projects/portfolio/fintech-suite/` — explicitly mounted subset

**Caveat:** I can only see those three. If there are sibling projects in `/Users/shaharsolomon/dev/projects/` (e.g., a separate Looma repo, personal tools, client work), they're not visible to me. If you want me to check those, mount the parent folder or the specific siblings.

---

## What's already done (impressive)

| Item | Status |
|---|---|
| Monorepo skeleton (`products/`, `oss/`, `infrastructure/`, `websites/`, `_archive/`) | ✅ Created |
| 7 products copied to `products/` | ✅ pushci (15K files), qestro (17K), lunaos (22K), opensyber (3.3K), sdlc-cc (4.1K), amliq (4.4K), tenantiq (3.8K) |
| 9 OSS components copied to `oss/` | ✅ a2a-framework, automationhub, clawpipe, design-system, homebrew-pipewarden, mcp-tooling, pipewarden, tokenforge (+ README) |
| 5 platform packages | ✅ ai-gateway, auth, billing, policy-engine, shared-types, telemetry |
| `websites/finsavvyai.com/` scaffolded (Astro 4 + Tailwind) | ✅ Done with accessibility skip-link, semantic landmarks |
| 35 archive manifests in `_archive/portfolio-snapshots/` | ✅ Source preserved for everything archived |
| `_archive/fintech-suite-wave1/` snapshot | ✅ Per addendum §1 |
| `_archive/migration-status.md` + `portfolio-migration-inventory.md` | ✅ Tracking docs in place |
| Resume files flagged for removal | ✅ Inventory caught the privacy issue |

**Round-4 inventory counts:** CORE 13 · OSS 12 · INFRA 16 · TOOLING 22 · DOC 39 · ARCHIVE 36 · DISSOLVE 1 (fintech-suite) = 139 entries classified.

The agents executing the migration are doing careful work — copies are non-destructive, every archive has a manifest, MIGRATION_NOTES.md files explain the choices, and source repos in `portfolio/` are untouched pending verification.

---

## Five things that need founder attention

### 1. `autoboot/` is misclassified — it's a PRODUCT, not infrastructure

**Current state:** inventory says `autoboot/` → `infrastructure/sprint-tooling/autoboot/` (INFRA bucket). Archive manifest also exists at `_archive/portfolio-snapshots/autoboot/ARCHIVED.md` flagging the conflict ("out of scope to disentangle here").

**Reality from the source repo:**
- `package.json` name: `"fastpm"`
- README title: "FastPM MCP Server"
- Last commit: "Rebrand AutoBoot to FastPM - Complete implementation"
- 6.7 GB on disk, 117,615 files
- Full marketing site (login, register, dashboard, pricing, password reset)
- LemonSqueezy payment integration
- VSCode extension, IntelliJ plugin, Netlify functions
- Last code change 2026-01-07 (about 4.5 months ago)

This is the FastPM product. The sprint harness is **not** in this directory — it's the root-level scripts (`harness.sh`, `sprint_daemon.py`, `_harness/`, `parity_harness.py`, etc.), which are correctly classified.

**Decision needed:** Reclassify `autoboot/` as **ARCHIVE** (FastPM product, parked domain) not INFRA. Promote the existing archive manifest from "conflict-flagged" to "final disposition: archive". Update inventory.

---

### 2. `looma-sh/` is being archived — confirm this kills live production

**Current state:** Archive manifest at `_archive/portfolio-snapshots/looma-sh/ARCHIVED.md`. Disposition: "off-thesis". Source still in `portfolio/looma-sh/` (2.3 GB, 123K files).

**What the manifest itself notes:**
> "Status (2026-05-08): Phase 1 (auth + persistence) shipped to production. Signup → lk_ API key flow live at relay.looma.sh."
> "Live: https://looma.sh (marketing), https://relay.looma.sh (API)."

**What the manifest does NOT note** (and should):
- `INVESTOR_BRIEF.md` exists — actively being pitched
- `IP_PROTECTION_STRATEGY.md` + checklist — IP work in progress
- `TRACTION.md`, `RISKS.md`, `ROADMAP.md`, `TEAM.md`, `TECH_DEEP_DIVE.md`, `OPENCLAW_COMPARISON.md`
- Free tier + paid tiers commercial model
- Multi-tenant production architecture

**Decision needed:** Archive is the wrong bucket. Three live options:

1. **Externalize (recommended)** — Spin out as separate sibling entity under personal cap table. Move `looma-sh/` out of `portfolio/` to its own top-level dir (`/Users/shaharsolomon/dev/projects/looma/`). Delete the archive manifest. Keep production running on its own velocity.
2. **Maintenance-only park** — Stop active dev, keep prod running. Leave repo in place, mark dormant in inventory.
3. **Sell/transfer** — Investor brief + live endpoints = credible micro-acquisition candidate. Worth one conversation before archiving.

What you should **not** do: let the migration agents proceed to delete `portfolio/looma-sh/` as planned for the final archive sweep. That kills live customer endpoints.

---

### 3. QueryFlux trio — decision pending, snapshots safely preserved

**Current state:** All three (`queryflux/`, `queryflux-git/`, `querylens/`) have archive manifests prepared, but `migration-status.md` correctly notes: "queryflux-git escalated to founder for fold-vs-archive call." Source preserved.

**My recommendation from the founder decisions memo:** Promote `queryflux-git` to **8th core product**.

- 791 active files, 578 MB
- Last commit 2026-05-23 (2 days ago)
- Tasks 9.x/11.x/13.x merged within the last 1-2 weeks (Code Generation Engine, SSO, Subscriptions, Security Hardening)
- Multi-platform: web + desktop + electron + mobile + MCP server + extensions
- Fills a real gap in the ecosystem: data layer for AI-coded apps
- LICENSE present

**Decision needed:** Confirm `queryflux-git` becomes `products/queryflux/` (with `queryflux/` and `querylens/` folded into it as `lens/`). Update the product table in the master plan, update `pnpm-workspace.yaml`, update GTM funnel.

If decision is to keep archiving, no action — the snapshots are already in place. But please confirm explicitly.

---

### 4. `a2a-framework` — migrated to `oss/` but STILL no LICENSE

**Current state:** Successfully copied to `oss/a2a-framework/` (153 files, 1.1 MB). The MIGRATION_NOTES.md file explicitly calls out:

> "**No LICENSE file** found in source repo. This is a problem for an OSS-positioned package."
> "**TODO (caller):** add an MIT or Apache-2.0 LICENSE file before any public OSS release. Until then, the framework is effectively all-rights-reserved."

The migration agent did its job (copy + note the gap) but the LICENSE wasn't added.

**Decision needed:** Confirm MIT (matches my recommendation and PipeWarden's likely license) or specify alternative. I can add it as soon as you say. Then add the same LICENSE to the source repo `portfolio/a2a-framework/` so they stay in sync until the source is deleted.

---

### 5. `opensource/` (vendored deps) not yet migrated

**Current state:** Inventory maps `opensource/` → `infrastructure/vendored/opensource/`, but `infrastructure/` currently has only `alerts/`, `cloudflare/`, `observability/`, `synthetics/`. The `vendored/` subtree doesn't exist yet.

**Why it matters:** This is a low-priority loose end — vendored third-party code that nothing currently depends on critically. But if any of the migrated products reference paths into `portfolio/opensource/`, those imports will break when source is deleted.

**Decision needed:** Either (a) create `infrastructure/vendored/` and migrate, or (b) confirm nothing depends on it and archive instead.

---

## Cleanup items the migration team is already handling

These are already in TODO state in `migration-status.md` and the inventory — no founder decision needed unless you want to override:

- `automationhub-upm/` — confirm if Unity Package Manager variant or unrelated; merge or archive
- `coderailflow/`, `coderail-dev/` — INFRA or LunaOS module decision
- `windsu-credit-manager/` — already decided archive (PushCI overlap confirmed incompatible)
- `flujo/` — already archived (last commit 14 months ago, stale)
- Resume `.docx`/`.pdf` files — flagged for removal from any public-facing repo
- Worktree variants (`.agent1`, `.agent2` dirs) — all 12 already snapshot+delete planned

---

## Other projects in the projects folder

I can only see the three mounted folders. Things I cannot check from here:

- Whether there are sibling projects outside `portfolio/` and `finsavvyai-platform/` (e.g., a standalone Looma repo if you've already started externalizing it, personal repos, client work, archived projects from before the consolidation)
- Whether `~/.config/`, `~/Library/`, or other system locations contain related state
- Git remotes (origin URLs, push targets) — would tell me if any of these are already on GitHub under different orgs

If you want me to check sibling projects, the easiest path is to either (a) mount `/Users/shaharsolomon/dev/projects/` itself instead of the individual subfolders, or (b) tell me specific paths to look at and I'll request mount access.

---

## Recommended next actions, in order

1. **Today (5 minutes):** Decide on MIT license for `a2a-framework`, I add the file.
2. **Today (5 minutes):** Confirm `looma-sh` should NOT be archived — pick externalize / park / sell, I update inventory and remove archive manifest.
3. **This week:** Decide on QueryFlux as 8th product. If yes, I update the addendum, plan, workspace config, README, and migration-status in one pass.
4. **This week:** Reclassify `autoboot/` from INFRA to ARCHIVE (FastPM product, parked domain). Update inventory entry. Take `fastpm.dev` down + redirect (if not already done).
5. **Next week:** Resolve `opensource/` vendored dir disposition (cheap, just needs a decision).
6. **Week after:** Begin the source-deletion sweep — once everything in `portfolio/` has been verified as migrated to the monorepo or snapshot-archived, the duplicates in `portfolio/` can be deleted (this is the migration's "Week 8" step).

If you want, I can do #1, #4, and the inventory updates for #2/#3/#5 right now — just say which decisions to lock in.
