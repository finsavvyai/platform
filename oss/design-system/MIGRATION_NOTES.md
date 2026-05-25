# F8 UI / Design System Migration Notes

Round 4, Days 61-90. Agent: SDLC-OPENSYBER.

## Source

| Source | Detail |
|---|---|
| Source path | `portfolio/packages` (F8 UI package set) |
| Git SHA | **none** — source directory has no `.git/` |
| Last filesystem mtime | 2026-05-13 |
| New path | `oss/design-system/` |
| Copy date | 2026-05-25 |

Per addendum §3: "satisfies 'shared design system' requirement."

## Package inventory

12 sub-packages under `@finsavvyai/*` namespace:

| Package | Namespace |
|---|---|
| `auth/` | `@finsavvyai/auth` |
| `cf-deploy/` | `@finsavvyai/cf-deploy` |
| `cf-stack/` | `@finsavvyai/cf-stack` |
| `cf-templates/` | `@finsavvyai/cf-templates` |
| `db/` | `@finsavvyai/db` |
| `llm/` | `@finsavvyai/llm` |
| `monitor/` | `@finsavvyai/monitor` |
| `pay/` | `@finsavvyai/pay` |
| `test-config/` | `@finsavvyai/test-config` |
| `ui/` | `@finsavvyai/ui` |
| `ui-marketing/` | `@finsavvyai/ui-marketing` |
| `ui-templates/` | `@finsavvyai/ui-templates` |

## Naming collisions — DO NOT add to workspace yet

**Critical:** `@finsavvyai/auth` exists in BOTH:
- `finsavvyai-platform/packages/auth/` (round-1 hardened implementation)
- `oss/design-system/auth/` (F8 implementation, different code)

Adding `oss/*` to `pnpm-workspace.yaml` today would create a duplicate package name and break resolution.

Decision REQUIRED from architect before any workspace inclusion:
1. **Rename F8 namespace** (e.g., `@finsavvyai-f8/*`) — preserves both implementations, low integration risk
2. **Replace platform packages** with F8 versions — requires audit of round-1 surfaces (round-2 conventions explicitly preserved them as "load-bearing")
3. **Keep F8 out of the workspace** — only published externally; products import via npm

Per round-4 conventions ("do NOT add to pnpm-workspace.yaml unless they import `@finsavvyai/*`"), the design system is NOT added to workspace this round. 41 self-references exist between F8 sub-packages — they work standalone via their internal symlinks/lockfile.

## LICENSE check

**No LICENSE file** found in any of the 12 sub-packages, nor at the root.

**TODO (caller):** add MIT or Apache-2.0 LICENSE before any public OSS release. The README positions this as the shared OSS design system; that positioning is incompatible with no license.

## Exclusions applied

Standard rsync excludes.

## File counts

- Source: 35165 files, 955M (before excludes — node_modules dominant)
- Target: 239 files, 2.2M (after excludes)

## Files exceeding 200-line cap

0 source files exceed the cap in the cleaned migration. Good baseline.

## Cross-product references

Self-contained — F8 packages reference each other via `@finsavvyai/*` within the design system. No outgoing references to SDLC.cc / OpenSyber / PipeWarden.
