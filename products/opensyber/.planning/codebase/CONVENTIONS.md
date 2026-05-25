# Conventions

## Language & modules

- **TypeScript** with `"type": "module"` and **ESM** `import`/`export` in apps and packages (see `apps/api/package.json`, `apps/agent/package.json`).
- **Path aliases** — Web uses `@/` for `apps/web/src/` (e.g. `apps/web/src/app/layout.tsx` imports `@/i18n/routing`). API uses relative imports to `.js` emit paths in Worker (`./routes/register.js`) consistent with `tsc` output.

## API (Hono) patterns

- Single **`Hono` app** instance extended with typed `Bindings` and `Variables` (`apps/api/src/types.ts` or adjacent).
- **Middleware order matters**: global logger → security → CORS → TokenForge on `/api/*` → rate limits → route registration (`registerRoutes` in `apps/api/src/index.ts`).
- **Route modules** — Sub-applications composed via `app.route(prefix, subApp)` in `apps/api/src/routes/register.ts`. When adding endpoints, prefer a dedicated module under `apps/api/src/routes/` and register in one place.
- **Validation** — **Zod** is a core dependency (`apps/api/package.json`); use for request/response schemas at route boundaries.
- **TokenForge skip paths** — Edits to public or alternate-auth routes must update the `skipPaths` / `sensitiveOps` arrays in `apps/api/src/index.ts` with a short rationale (existing comment block).

## Frontend (Next.js) patterns

- **App Router** — Prefer server components where possible; client components when using hooks or browser APIs (`'use client'`).
- **Styling** — **Tailwind CSS 4** + `tailwind-merge` + `clsx` for class composition (`apps/web/package.json`).
- **i18n** — Use `next-intl` patterns (`getLocale`, `getMessages` in `apps/web/src/app/layout.tsx`); locale config under `apps/web/src/i18n/`.
- **Auth** — `SessionProvider` wraps authenticated trees; align with `packages/auth` exports and NextAuth route handlers.

## Database

- **Drizzle** schema definitions in `packages/db/src/schema/`; migrations are **versioned SQL** under `packages/db/migrations/`.
- **Migrations** — Apply via Wrangler D1 commands (`packages/db` scripts); API worker points `migrations_dir` at `packages/db/migrations` in `apps/api/wrangler.toml`.

## Monorepo

- **pnpm workspaces** — Internal deps use `workspace:*` in `package.json`.
- **Turbo** — Task graph in `turbo.json`; `build` depends on `^build` for topological builds.

## Error handling & logging

- API uses **Hono logger** middleware globally (`apps/api/src/index.ts`).
- Prefer explicit HTTP status and JSON error bodies in route handlers; align with existing route modules for consistency.

## Security-minded defaults

- **CORS** allowlist is explicit in `apps/api/src/index.ts` — do not widen `origin` without review.
- **Rate limiting** is route-class based — new public endpoints should use the appropriate tier.

## Formatting

- Root provides **Prettier** (`package.json` `format` / `format:check`). Run before large merges when touching many files.

---
*Generated for GSD codebase map — focus: quality / conventions*
