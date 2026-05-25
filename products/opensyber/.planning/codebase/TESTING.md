# Testing

## Frameworks by area

| Area | Runner | Config / entry |
|------|--------|----------------|
| API Worker | **Vitest** | `apps/api/vitest.config.ts` — `pnpm --filter @opensyber/api test` |
| Web (unit/component) | **Vitest** + **Testing Library** | `apps/web/vitest.config.ts`, `apps/web/src/__tests__/` |
| Web (E2E) | **Playwright** | `apps/web/playwright.config.ts`, specs under `apps/web/e2e/` |
| Web (visual regression) | **Playwright** `toHaveScreenshot` | Project `visual` in `playwright.config.ts`; scripts `test:visual` in `apps/web/package.json` |
| Agent daemon | **Vitest** | `apps/agent/vitest.config.ts` |
| Shared packages | **Vitest** | e.g. `packages/shared/vitest.config.ts`, `packages/ui/vitest.config.ts`, `packages/tokenforge/vitest.config.ts` |
| TokenForge API | **Vitest** | `apps/tokenforge-api/vitest.config.ts` |
| Load / stress | **k6** (optional) | `apps/api/k6/*.js`, npm scripts `k6:smoke`, `k6:load`, `k6:stress` |
| Claw gateway | Placeholder / Playwright note | `apps/claw-gateway/package.json` — `test:integration` runs Playwright |

## API testing patterns

- Tests live under `apps/api/src/` with `*.test.ts` naming (example: `apps/api/src/routes/health.test.ts`).
- Helpers often construct a Hono app with mocked `Env` bindings for Worker context.

## Web E2E patterns

- **Auth setup** — Playwright project `setup` matches `auth-setup.spec.ts`; `authenticated` project uses storage state `apps/web/e2e/.auth/user.json` (generate via setup flow — see `apps/web/e2e/fixtures/auth.ts` and `e2e/visual/README.md`).
- **Base URL** — `E2E_BASE_URL` overrides default production URL in `playwright.config.ts` for local runs.
- **Visual snapshots** — Baselines are gitignored per `apps/web/e2e/visual/README.md`; CI may upload artifacts on failure.

## Coverage

- Web lists `@vitest/coverage-v8` as devDependency; enable via Vitest CLI flags when needed per package.

## CI alignment

- Playwright uses `github` reporter when `CI` is set (`apps/web/playwright.config.ts`).

## Practical commands (from package scripts)

```bash
pnpm --filter @opensyber/api test
pnpm --filter @opensyber/web test
pnpm --filter @opensyber/web test:e2e
pnpm --filter @opensyber/web test:visual
pnpm --filter @opensyber/agent test
```

---
*Generated for GSD codebase map — focus: testing*
