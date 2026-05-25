# Brand-decision blocker — 2026-05-01

User-led audit of the live shipped surface (clawpipe.ai + sister-site
footers) surfaced four issues. One is a trademark / misrepresentation
exposure; the other three are broken trust signals. Documenting here
so they don't get re-introduced before the rename decision lands.

## The catastrophic finding — "OpenClaw" is taken

The parent brand referenced in every footer ("Part of the OpenClaw
family") collides with an existing, famous open-source project:

- **`github.com/openclaw/openclaw`** — viral AI-agent project, ~68k
  stars, founded by Peter Steinberger (PSPDFKit founder).
- **NVIDIA "NemoClaw for OpenClaw"** announced at GTC. Jensen Huang
  has spoken about it publicly.
- **`openclaw.cc`** is the documentation site.

Implication: every technical buyer reading "Part of the OpenClaw
family" parses it as either (a) we're affiliated with that project
(we aren't) or (b) we're squatting (which is the riskier reading).
Both destroy credibility on first contact and create a trademark
exposure if challenged.

**Status**: all "OpenClaw family" copy pulled from shipped surfaces
in commit `[set after pulling]`. The brand-consolidation plan that
recommended unifying *under* OpenClaw is invalidated. **Do not pick
a parent brand without first running a clean-browser Google search
of the proposed name.** If the top 5 results aren't yours, the brand
isn't available.

## The reachability findings

Three of the four "family" sister-sites are unreachable or unfindable:

| Domain | Status | Implication |
|---|---|---|
| `tenantiq.com` | Empty 200 response | Every footer click lands on a blank page. Worse than 404. |
| `tenantiq.ai` / `tenantiq.co` / `tenantiq.co.uk` | Owned by 3 unrelated companies | The TenantIQ brand is unwinnable in Google for *our* product. |
| `@TenantIQ` on X | No website link, July 2025 join | If this is the cyber-themed product, it has no findable web presence. |
| `sdlc.cc` | 403 Forbidden | Bot-blocked or broken — either way, every footer click errors. The "sdlc" abbreviation is owned by the technical concept (CrowdStrike, Wiz, IBM, Palo Alto outrank it forever). Even `site:sdlc.cc` returns nothing — the site isn't indexed. |
| `opensyber.cloud` | (footers cite — not separately audited) | At minimum: stop linking from anywhere until the parent-brand question is resolved. |

## Open decisions (founder-only)

These are not engineering questions and the codebase shouldn't
re-introduce these references until they're answered:

1. **Is TenantIQ alive?** If alive, point `tenantiq.com` at *something*
   (placeholder, splash, status message) within 24 hours and rename
   because the SEO is unwinnable. If dead, remove from every footer
   permanently.
2. **Is `sdlc.cc` bot-blocking on purpose?** If yes, fine —
   confirm intentional and stop linking from public footers (anonymous
   visitors get 403). If broken, fix or take down. Either way, the
   "sdlc" SEO battle is unwinnable.
3. **What replaces "OpenClaw" as the parent brand?** Running a clean
   Google search before locking it in is mandatory. The target check:
   top 5 results for the unqualified brand name should already be
   ours. If they aren't, the brand isn't available.

## Code state after pull

- `landing-page/index.html`: footer "Part of the OpenClaw family" line
  removed (line 666 before, now removed).
- `landing-page/accounts.html`: 144-line cross-sell page replaced with
  a 45-line "this page is being updated" holding page. `noindex,
  nofollow` meta tag added so search engines drop it. ClawPipe signup
  link preserved as the single conversion path.
- `landing-page/sitemap.xml`: `/accounts` URL removed.
- `README.md`: top-of-file "Part of the OpenClaw family" line removed.
- `CHANGELOG.md`: 4 historical references in older entries (3.4.0/3.5.0
  era) left in place — they describe internal code ports between
  sister products and rewriting them would re-introduce the brand
  question. Defer until rename is decided.

## Skill gaps the audit exposed

User flagged three gaps in their site-audit skill that would have
caught this earlier:

1. **No reachability check.** The 12-point checklist assumes sites
   respond. Should open with: "does the site load? if not, that's
   the entire audit until it does."
2. **No external brand-collision check.** Item #3 ("brand sprawl")
   covers internal sprawl across owned surfaces but not collision
   with existing famous brands or generic technical terms. The check
   is one Google search of the parent-brand name with no qualifiers.
3. **Brand-consolidation template assumes the parent brand is
   available.** Step 0 should mandate the clean Google search before
   anything else.

User offered to patch the skill. Skill files live under their plugin
directory; awaiting their direction on whether they want me to write
the patch or do it themselves.
