# Sprint 38 — Developer DX & Distribution

**Goal**: Make TokenForge feel like Stripe-for-payments. `npm install`, two HTTP endpoints, drop-in middleware. The market wedge isn't crypto — it's that a backend dev can integrate in an afternoon and ship to production. Cisco Duo requires SAML/OIDC + an admin console; TokenForge requires `app.use(tokenforge())`.

**Strategic frame**: Self-serve via LemonSqueezy, free tier with unlimited end-users on one origin (we make money when developers ship to production scale, not when they kick the tires).

## Existing surface (audited 2026-04-27)

- `packages/tokenforge/` SDK (client / server / shared / react)
- `packages/tokenforge/adapters/` — hono.ts, express.ts, fastify.ts, nextjs.ts (functional but skeletal)
- `packages/tokenforge-sdks/` — go, kotlin, mcp, python, react-native, swift (native bind/sign)
- LemonSqueezy fully wired (memory: project_lemonsqueezy.md)
- Pricing page exists (`apps/tokenforge-web/src/app/pricing/`) — has 4 plans + SSE bundle callout shipped today

**Gaps to close**:
- Adapters lack ergonomic helpers (no `.protect(['/admin/*'])`, no per-route `.requireFreshSig()`)
- No SvelteKit, Astro, Bun.serve, Deno, Elysia adapters
- npm publish workflow exists but coverage of frameworks is incomplete
- No 5-minute quickstart in docs
- No code-mod CLI (`npx tokenforge init` to add SDK script + middleware to an existing repo)
- Free tier exists per pricing page but no "unlimited end-users on one origin" SKU yet

## Scope (in)

1. **Hono adapter v2** — `app.use(tokenForge({ apiKey }))` plus `app.use('/admin/*', tokenForge.requireFreshSig())` chain helpers
2. **Express adapter v2** — same surface, `app.use('/admin', tokenForge.requireFreshSig())`
3. **Fastify adapter v2** — plugin-based with same hooks
4. **Next.js middleware v2** — drop-in `middleware.ts` matcher; per-route `protect()` for App Router routes
5. **SvelteKit adapter** — `handle` hook in `hooks.server.ts`
6. **Astro adapter** — middleware sequence helper
7. **Bun + Hono adapter** — explicit support / docs
8. **Code-mod CLI** — `npx @opensyber/tokenforge init` adds SDK script tag, env vars, and adapter wiring to existing repos. Detects framework from `package.json`.
9. **5-minute quickstart docs** — `apps/tokenforge-web/src/app/docs/quickstart/page.tsx` with framework-specific copy
10. **Sample apps** — `examples/{nextjs,sveltekit,express,hono}` minimal apps, each ≤50 lines of TF code, deployable to Vercel/CF
11. **Free tier SKU** — LemonSqueezy product configured for "TokenForge Solo Free": unlimited end-users on one origin, 100 verifications/min rate cap, single API key
12. **OpenAPI spec** — auto-generate from Hono routes via `@hono/zod-openapi`; ship to docs page so customers can codegen clients in their language
13. **Dashboard "Quickstart" wizard** — first-login state shows a copy-paste snippet for the user's detected framework, walks through API key creation, links to docs

## Scope (out)

- Cross-origin / multi-origin policy editor (later)
- Federated identity / SSO admin (out — that's Duo's game)
- Self-serve billing analytics dashboard for the customer's customers (later)

## Tasks

| # | Task | File(s) | Lines | Test |
|---|---|---|---|---|
| 1 | Hono adapter v2 — `tokenForge({apiKey})` + `requireFreshSig()` | `packages/tokenforge/src/adapters/hono.ts` (rewrite) | ≤180 | unit test, integration test |
| 2 | Express adapter v2 | `packages/tokenforge/src/adapters/express.ts` (rewrite) | ≤180 | supertest integration |
| 3 | Fastify adapter v2 | `packages/tokenforge/src/adapters/fastify.ts` (rewrite) | ≤180 | fastify.inject |
| 4 | Next.js middleware v2 | `packages/tokenforge/src/adapters/nextjs.ts` (rewrite) | ≤180 | matcher unit test |
| 5 | SvelteKit adapter | `packages/tokenforge/src/adapters/sveltekit.ts` | ≤150 | hook unit test |
| 6 | Astro adapter | `packages/tokenforge/src/adapters/astro.ts` | ≤120 | unit test |
| 7 | Bun + Hono adapter doc + smoke | `packages/tokenforge/src/adapters/bun.ts` | ≤80 | smoke test |
| 8 | Code-mod CLI | `packages/cli/src/commands/init.ts` + framework detectors | ≤200 each | golden-output test |
| 9 | 5-min quickstart docs | `apps/tokenforge-web/src/app/docs/quickstart/page.tsx` + framework subpages | ≤200 ea | screenshot |
| 10 | Sample apps | `examples/{nextjs,sveltekit,express,hono}/` | n/a | each deploys, smoke test |
| 11 | LemonSqueezy free tier product | LS dashboard + `packages/shared/src/data/plan-configs.ts` (+20) | <200 total | webhook test |
| 12 | OpenAPI spec generation | `apps/tokenforge-api/src/openapi.ts` | ≤180 | schema validate test |
| 13 | Dashboard quickstart wizard | `apps/tokenforge-web/src/app/dashboard/quickstart/page.tsx` | ≤200 | UI test |
| 14 | Update README + landing copy | `README.md`, `apps/tokenforge-web/src/components/landing/HeroSection.tsx` | <100 lines changed | visual diff |

## Exit criteria

- [ ] `npx @opensyber/tokenforge init` on a fresh Next.js / SvelteKit / Express / Hono / Astro / Bun project completes in under 30 seconds and produces a working integration with one API key call
- [ ] All five sample apps deploy to Vercel/CF Pages from `examples/` with a single `npm run deploy`
- [ ] Free tier "TokenForge Solo Free" purchasable (free) via LemonSqueezy; rate limiter trips at 100 RPM/origin
- [ ] OpenAPI spec validates against Spectral / Redocly; doc page renders Swagger UI
- [ ] Dashboard first-login shows correct framework detection and copy-paste snippet
- [ ] Each adapter has its own unit test suite (>=90% line coverage)
- [ ] No file >200 lines
- [ ] Quickstart promise is real: a developer can be live on `localhost` in 5 minutes following the docs (timed manual test, recorded video to `.luna/sprint-38-developer-dx/quickstart-demo.mp4`)
- [ ] Landing hero updates lead with "Cookieless sessions, in 5 minutes" — not "MFA platform"

## Dependencies / risks

- **Adapter API stability** — once we ship v2 adapters, breaking changes hurt. Mitigation: lock surface area with strict tests, mark v1 adapters as deprecated for one minor version before removal.
- **Framework version drift** — Next.js / SvelteKit have aggressive release cycles. Mitigation: pin major versions in samples; CI matrix runs against last 3 majors.
- **Code-mod CLI complexity** — codemods rot quickly. Mitigation: keep init logic pattern-based (regex on file boundaries), not AST; refresh quarterly.
- **Free tier abuse** — Mitigation: per-origin rate limits, not per-user; one origin per API key; clear ToS.

## Estimated size

- Dev: 7–9 days
- Sample apps + smoke tests: 2 days
- Docs + screen recording: 2 days
- Total: ~2 sprints

## Followup

- Vue / Solid / Qwik adapters as community PRs
- Self-host one-click for Render / Railway / Hetzner (covered indirectly by SDLC platform)
- "Auth0/Clerk migration guide" doc (sales lever)
