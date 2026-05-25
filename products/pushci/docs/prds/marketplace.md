# PRD: Marketplace for Shared Pipelines with Cost Transparency

**Status:** Draft for review
**Author:** roadmap-2026-05-16
**Tracks issue:** #24
**Last updated:** 2026-05-16

## Problem

GitHub Actions Marketplace exists and is the default place a
developer looks for "how do I run X in CI?" — but it has two
properties that PushCI's wedge can exploit:

1. **Cost is hidden.** Marketplace listings tell you what an
   action does, never what it costs to run. A user installs
   `actions/cache@v4`, the action does its job, and at the end
   of the month they see an opaque GitHub Actions bill that
   does not break out which actions ate which minutes.
2. **Discovery is one-directional.** You search Marketplace
   from GitHub. There is no equivalent of "I just ran this
   pipeline 200 times, here's how much it cost on Actions vs
   alternatives." The data exists (GitHub publishes per-action
   timing in the workflow logs) but no one surfaces it.

PushCI is the right shape to be the cost-transparent shadow
marketplace because it already has the cost data: every
pipeline run on PushCI has the local wall-clock time, and the
$/min comparison is one calculation away.

The candidate product: **a marketplace of shared `pushci.yml`
fragments and full pipelines, annotated with empirical cost
comparison data.** Every listing carries: "this pipeline runs
in 4m12s on PushCI's local CLI ($0). The equivalent GitHub
Actions workflow would cost ≈$0.34 per run on Linux at the
public rate." Installation is one command (extends the existing
`pushci voice install <url>` flow).

## Who this is for

- **Publishers:** OSS maintainers who already publish GitHub
  Actions and have a working pipeline they want to share more
  broadly. The dual-listing motion (publish on GHA Marketplace
  *and* PushCI Marketplace) costs them ~10 minutes per
  pipeline if the cost data is auto-computed.
- **Consumers:** developers who want a working pipeline for
  $LANG/$FRAMEWORK and currently start by reading three GHA
  templates and merging them into one. They want a tested
  template, fast install, and to know what it costs.
- **Anti-target:** enterprise pipelines that need air-gapped
  review and a signed software supply chain attestation. That
  is a closed-system feature, not a marketplace one. Track in
  a future Enterprise pipeline-bundle PRD if demand surfaces.

## Differentiation vs GitHub Actions Marketplace

| Property | GHA Marketplace | PushCI Marketplace |
|---|---|---|
| Lists pipelines (multi-action) | No (only single actions) | Yes |
| Shows $ cost per run | No | Yes (empirical + GHA comparison) |
| Install command | Paste 10 lines of YAML | `pushci install <name>` |
| Test data on submission | Optional | Required (publisher must submit 5 successful run logs) |
| Sandboxed / signed | No (actions run with full token) | Yes (see Trust Model) |
| Searchable by language/framework | Partial | Yes (PushCI already detects 35 languages, 39 frameworks; marketplace inherits that metadata) |
| Web index | github.com/marketplace | pushci.dev/marketplace |
| CLI index | None | `pushci marketplace search <q>` |

## Trust model

The hardest problem. A marketplace where anyone can publish a
pipeline that runs on the consumer's developer machine has
real supply-chain risk. Four-layer defence:

1. **Signed manifests.** Every published listing is a tarball
   with a manifest (`pipeline.yaml`, README, optional logo,
   per-run sample data). Publisher signs with sigstore
   (cosign keyless via OIDC). Consumer's `pushci install`
   verifies the signature before extracting.
2. **Sandbox by default.** Installed pipelines run in the
   same dry-run mode `pushci run --dry-run` already supports:
   no network egress except declared endpoints, no filesystem
   access outside the project dir, no environment variable
   exfiltration. The first run prompts the user to approve
   each capability the pipeline declared up-front in
   `pipeline.yaml#permissions`.
3. **Review queue for promoted listings.** Anyone can publish
   (low friction), but only listings that pass a human review
   get the "PushCI Verified" badge and surface in the default
   search results. Unverified listings are accessible by
   direct URL but de-ranked. Review SLA: 5 business days.
4. **Audit trail.** Every `pushci install` writes the listing
   URL + signature hash + manifest digest to `~/.pushci/audit.log`
   so a security-conscious user can review what's been pulled
   onto a machine without grep'ing the project history.

## Cost data: how the comparison number is generated

Two sources, in order of preference:

1. **Empirical (preferred):** publisher submits 5+ successful
   PushCI run logs at submission time. Marketplace API
   computes median wall-clock duration. GHA comparison is
   computed as `median_seconds / 60 * $0.008` (GitHub's
   published Linux rate). Listing shows the empirical number.
2. **Computed (fallback):** if the publisher does not submit
   run logs, the marketplace publishes only a "no empirical
   data — install and measure" note. No invented numbers.
   This is the anti-bluff rule from CLAUDE.md applied at
   product layer.

Submitted logs are anonymised at ingestion: stripped of
secrets-shaped tokens (re-uses gitleaks rules), commit hashes
redacted, file paths normalised. Raw logs are not displayed —
only the timing summary is.

## Discovery UX

- **`pushci marketplace search <query>`** (CLI): hits the
  Workers API, returns top 10 listings with name, language,
  estimated $/run vs GHA, and verified badge.
- **`pushci marketplace install <name>`** (CLI): downloads,
  verifies signature, runs first-time approval prompt,
  writes the pipeline into `pushci.yml` (with a `# from
  marketplace: <listing>@<version>` header so the user
  knows where it came from).
- **pushci.dev/marketplace** (web): filterable browse UI
  with same fields as CLI. Each listing page shows the
  README, the cost-comparison chart, the trust badges, and
  a "use this on your repo" button that copies the
  install command.
- **Linked from `pushci init`:** when stack/framework
  detection finds a match, init suggests the top
  marketplace listing for that combo before falling back
  to the default template. Opt-in via prompt; never auto.

## Integration with `pushci voice install`

The existing `pushci voice install <https-url>` flow installs
community voice personas. The marketplace is the same shape:
a remote URL → local artifact installed under a managed
directory. Decision: **extend, don't replace**.

- Keep `pushci voice install` as the URL-anywhere installer
  (works for any HTTPS URL serving a valid manifest).
- Add `pushci marketplace install <name>` that resolves the
  short name against the Marketplace registry, then calls
  the same internal install routine with the resolved URL.
- The Marketplace is just one resolver; URL-direct stays.

## Monetization

Three options on the table, ordered by recommended priority:

1. **Free for OSS, revenue share for paid templates.** Most
   listings are free. Paid templates (enterprise compliance
   bundles, language-specific advanced templates) are sold
   per-install with 70% to publisher, 30% platform. Lemon
   Squeezy already supports per-transaction marketplace
   payouts; no new billing rail needed.
2. **Sponsored listings.** Vendor X pays for their pipeline
   to appear in the default `pushci init` suggestion for
   their language/framework. Risk: corrupts trust. Defer.
3. **No monetization at all.** Pure community marketplace,
   funded out of the Pro/Team revenue line. Risk: no
   publisher incentive to keep listings fresh. Defer.

Recommend (1). Launch with revenue-share rail wired but no
paid templates on day 1; first paid template is a real
publisher's choice, not ours.

## 90-day rollout

1. **Wk 1–3:** Marketplace API surface (new mount in
   `api/src/index.ts`, D1 migration for `marketplace_listings`
   + `marketplace_runs` tables). Cosign verification path
   in Go CLI.
2. **Wk 4–5:** CLI commands: `pushci marketplace search`,
   `install`, `submit`. `submit` is interactive: prompts for
   manifest fields, walks publisher through cosign signing.
3. **Wk 6–7:** Web index at `pushci.dev/marketplace`. Filter
   UI, listing detail pages, cost-comparison chart component
   (reuses BillSavingsCalc styling for visual consistency).
4. **Wk 8–9:** Trust review SOP: who reviews, what they
   check, how SLA is tracked. Initial reviewer pool = 2
   internal + 1 external security consultant on retainer.
5. **Wk 10–11:** Seed listings — convert 20 of our own
   `pushci.yml` templates into marketplace listings with
   real run data. This is the "we eat our own dogfood"
   step before opening submissions.
6. **Wk 12:** Public launch. Curb-voice landing copy:
   "All the pipelines, none of the YAML, and the receipt
   is itemised." Show HN, Dev.to article, Twitter thread.

## Out of scope

- **Private marketplace per org** — would be Enterprise
  feature, separate PRD when demand surfaces.
- **Cross-CI marketplace** (listings runnable on GHA or
  CircleCI as well) — runtime-portability is real but big;
  defer.
- **Marketplace for skills** (`pushci skill install`) — a
  parallel surface for AI agent skills exists in
  `internal/skill/`; same trust mechanics but different
  artifact shape. Cross-link in shared trust model when
  both ship.

## Open questions

- **Cosign keyless OIDC providers:** GitHub-only initially or
  GitHub + GitLab + Google? Recommend start with GitHub
  because every PushCI user already has that account.
- **What counts as a "pipeline" vs an "action":** do we
  list multi-stage pipelines only, or also single-stage
  helpers? Recommend pipelines only — the differentiator
  is "complete pipeline with cost transparency", and
  helpers belong in the action layer where GHA already wins.
- **Per-version pricing for paid templates:** flat $X/install
  or subscription? Recommend flat per-install with
  publisher-set upgrade discount. Subscription is too
  heavy for individual templates.
