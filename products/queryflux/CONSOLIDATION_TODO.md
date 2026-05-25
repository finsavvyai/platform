# QueryFlux — Consolidation TODO

After round-4 migration, these are the open items before QueryFlux is fully integrated into the platform.

## P0 — structural

- [ ] Restructure source tree per memo layout:
  ```
  products/queryflux/
  ├── web/          (from src + website)
  ├── desktop/      (from queryflux-desktop, queryflux-electron)
  ├── mobile/       (from mobile/)
  ├── mcp-server/   (from queryflux-mcp-server)
  ├── lens/         (already folded from querylens, querylens-api)
  └── backend/      (from queryflux-backend, queryflux-worker)
  ```
- [ ] Resolve any duplicate package.json names across subdirs.
- [ ] Decide: single root package.json with workspaces, OR keep each subdir self-contained?

## P1 — platform integration

- [ ] Replace local SSO with `@finsavvyai/auth` (round-1 hardened: JWT alg-pinned, MFA-ready).
- [ ] Replace local Subscriptions with `@finsavvyai/billing` (round-2: Stripe + LemonSqueezy webhook verifiers, entitlement resolver).
- [ ] Wire `@finsavvyai/telemetry` audit-log on every agent-issued query (audit shape: `{ts, actor_id, event:"queryflux.query", resource, decision, reason}`).
- [ ] Wire `@finsavvyai/policy-engine` for agent-query policy evaluation.
- [ ] If the MCP server proxies agent prompts to LLMs: route through `@finsavvyai/ai-gateway`.

## P1 — workspace

- [ ] Decide if `products/queryflux/` enters the root pnpm workspace.
  - Today: NOT in workspace globs (per round-4 rule "only add if importing @finsavvyai/*").
  - Becomes YES once any platform integration above lands.

## P2 — deployment

- [ ] Migrate wrangler.toml(s) under queryflux to use the platform's worker-naming convention (`finsavvy-queryflux-<env>`).
- [ ] Wire health endpoint to platform mesh contract §1 shape.
- [ ] Add to `infrastructure/synthetics/probes/queryflux-*.mjs` (at least: health, query-happy-path, denied-query).
- [ ] Add to `infrastructure/alerts/rules.yaml`: `QUERYFLUX_POLICY_DENY_SPIKE`, `QUERYFLUX_QUERY_LATENCY_P95`, `QUERYFLUX_TENANT_ISOLATION_BREACH`.
- [ ] Write `docs/runbooks/QUERYFLUX_*.md` for each.

## P2 — GTM

- [ ] Update website (`websites/finsavvyai.com/`) product table to include QueryFlux.
- [ ] Update the developer adoption funnel copy in marketing materials to mention QueryFlux.
- [ ] Document the QueryFlux ↔ MCP integration as a developer onboarding story (every Cursor user is a QueryFlux candidate).

## P3 — quality cleanup

- [ ] Audit source for any file >200 lines; split per portfolio rule on first non-trivial edit.
- [ ] Confirm LICENSE alignment with rest of the OSS stack (memo: source already has LICENSE).
- [ ] Add CONTRIBUTING.md if MCP server portion goes public OSS (per memo: `oss/queryflux-mcp/` dual-publish).
