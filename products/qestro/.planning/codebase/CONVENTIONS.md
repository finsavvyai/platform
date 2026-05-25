# Coding Conventions

**Analysis Date:** 2026-04-22

## Naming Patterns

**Files:**
- Use `PascalCase.ts(x)` for most React components and many backend services/classes (examples: `frontend/src/components/atoms/Checkbox.tsx`, `frontend/src/components/layout/AppLayout.tsx`, `backend/src/services/QestroAIService.ts`, `backend/src/services/AIService.ts`).
- Use `camelCase.ts` for middleware/utilities/routes and many API helpers (examples: `backend/src/middleware/auth.ts`, `mobile/src/lib/api/ai.ts`, `src/services/auth-service.ts`).
- Use `kebab-case.ts` for worker/service modules and some route files (examples: `backend/src/services/playwright-runner-utils.ts`, `backend/src/services/ai-chat-agent.ts`, `backend/src/services/apm/routes/apm.routes.ts`).
- Keep package-local naming conventions per area; do not force one style globally because existing code is mixed by subsystem.

**Functions:**
- Use `camelCase` for functions and handlers (examples: `authenticateUser()` in `backend/src/middleware/auth.ts`, `generateTest()` in `mobile/src/lib/api/ai.ts`, `extractUser()` in `frontend/src/stores/authStore.ts`).
- Use `PascalCase` only for classes and React components (examples: `WebRecordingController` in `backend/src/controllers/webRecordingController.ts`, `ConfidenceMeter` in `mobile/src/components/molecules/ConfidenceMeter.tsx`).

**Variables:**
- Use `camelCase` for local variables and state (`formData`, `mockState`, `defaultDateRange` in `frontend/src/pages/LoginPage.tsx`, `frontend/src/components/auth/__tests__/ProtectedRoute.test.tsx`, `frontend/src/stores/uiStore.ts`).
- Use `UPPER_SNAKE_CASE` for constants intended as immutable config (`API_URL`, `OAUTH_PROVIDERS` in `frontend/src/stores/authStore.ts` and `frontend/src/pages/LoginPage.tsx`).

**Types:**
- Use `PascalCase` for interfaces/types (`AuthState`, `JWTPayload`, `TestUser` in `frontend/src/stores/authStore.ts`, `backend/src/middleware/auth.ts`, `tests/e2e/fixtures/test-users.ts`).
- Use suffixes like `Props`, `State`, `Request`, `Response` where applicable (`ConfidenceMeterProps` in `mobile/src/components/molecules/ConfidenceMeter.tsx`, `RecordingStartRequest` in `backend/src/controllers/webRecordingController.ts`).

## Code Style

**Formatting:**
- Prettier is enforced through `lint-staged` at repo root (`package.json`) for `*.{js,jsx,ts,tsx,json,md,yml,yaml}`.
- Root ESLint expects single quotes, no semicolons, trailing commas disallowed, indent 2 (`.eslintrc.js`).
- Mobile has explicit Prettier settings with semicolons and trailing commas (`mobile/.prettierrc`), so style differs by package.

**Linting:**
- Root worker/shared code uses TypeScript ESLint with strict stylistic rules (`.eslintrc.js`).
- Frontend uses flat ESLint config and mostly warning-level transitional gates (`frontend/eslint.config.js`).
- Backend disables many strict rules (`backend/.eslintrc.cjs`), prioritize compatibility over strictness there.
- Mobile enforces `no-explicit-any` and `no-unused-vars` as errors (`mobile/eslint.config.js`).

## Import Organization

**Order:**
1. External packages first (`react`, `zustand`, `express`, `vitest`).
2. Internal aliases or app modules next (`@/...` in mobile, relative app modules in frontend/backend).
3. Types are often imported with `type` qualifiers when used (`frontend/src/stores/uiStore.ts`, `mobile/src/lib/api/ai.ts`).

**Path Aliases:**
- Mobile uses `@/*` aliases (`mobile/tsconfig.json`, imports in `mobile/src/__tests__/lib/api/projects.test.ts`).
- Worker root uses `@/` aliases (`src/utils/response.ts`, `vitest.config.ts` alias map).
- Frontend primarily uses relative imports (`frontend/src/pages/LoginPage.tsx`) with selective `@` alias support in `frontend/vitest.config.ts`.

## Error Handling

**Patterns:**
- Use `try/catch` with early `return` for API handlers and middleware (`backend/src/controllers/webRecordingController.ts`, `backend/src/middleware/auth.ts`).
- Return structured JSON errors with HTTP status in Express routes/controllers (`{ error: '...' }` or `{ success: false, error: '...' }`).
- In state stores/services, catch `unknown` and normalize to human-readable messages (`frontend/src/stores/authStore.ts`).
- For optional flows, fail soft and continue where required (`optionalAuth` in `backend/src/middleware/auth.ts`).

## Logging

**Framework:** Custom structured logger plus direct console usage.

**Patterns:**
- Prefer `logger.info/warn/error` from `backend/src/utils/logger.ts` in backend routes and middleware.
- Log context objects (user/session/request metadata) instead of only plain strings (`backend/src/utils/logger.ts`).
- Legacy/bridge services still use `console.log/error` (`backend/src/services/QestroAIService.ts`); match local file style unless refactoring intentionally.

## Comments

**When to Comment:**
- Use concise section comments for route grouping and control flow boundaries (`backend/src/routes/oauth.ts`, `backend/src/controllers/webRecordingController.ts`).
- Add rationale comments for environment/compat behavior (`frontend/src/stores/authStore.ts`, `tests/e2e/utils/test-helpers.ts`).

**JSDoc/TSDoc:**
- Widely used in backend services and E2E helpers for public APIs (`backend/src/services/QestroAIService.ts`, `tests/e2e/page-objects/LoginPage.ts`, `tests/e2e/fixtures/auth.fixture.ts`).
- Keep doc blocks focused on intent/contract, not restating obvious code.

## Function Design

**Size:** Mixed; both small helpers and very large controller/store files exist. Prefer helper extraction for new logic in large files (`backend/src/controllers/webRecordingController.ts`, `frontend/src/stores/authStore.ts`).

**Parameters:**
- Use typed object params for multi-field inputs (`generateTest(data)` in `mobile/src/lib/api/ai.ts`, structured payloads in backend controllers/services).
- Keep event handlers and middleware signatures explicit (`(req, res, next)` in `backend/src/middleware/auth.ts`).

**Return Values:**
- API/controller methods return HTTP responses directly.
- Service/store methods return typed `Promise<T>` and explicit success/error envelopes where possible (`src/services/auth-service.ts`, `frontend/src/stores/authStore.ts`).

## Module Design

**Exports:**
- Use named exports for utilities/components and optional default export for primary module object/class (`backend/src/utils/logger.ts`, `frontend/src/components/atoms/Checkbox.tsx`).
- Keep both compatibility aliases and canonical exports where legacy consumers exist (`backend/src/middleware/auth.ts`).

**Barrel Files:** Used heavily for components/services schema aggregation (`frontend/src/components/molecules/index.ts`, `frontend/src/components/atoms/index.ts`, `src/db/schema.ts`, `backend/src/services/*/index.ts`).

---

*Convention analysis: 2026-04-22*
