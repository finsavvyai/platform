# Coding Conventions

**Analysis Date:** 2026-04-22

## Naming Patterns

**Files:**
- TypeScript/TSX files are predominantly kebab-case and suffix-based: `services/admin-ui/src/components/ui/data-table.tsx`, `services/admin-ui/src/components/ui/button.stories.tsx`, `packages/shared-auth/src/__tests__/auth-user.test.ts`.
- Python module files use snake_case: `services/dlp/app/services/fast_pii_detector.py`, `services/rag/app/services/context_retrieval/service.py`.
- Go files use snake_case with domain-oriented names: `services/gateway/internal/interfaces/http/handlers/auth.go`, `services/gateway/internal/infrastructure/database/repository/repository_test.go`.

**Functions:**
- Use camelCase for TypeScript/JavaScript functions and hooks: `useApi`, `formatRelativeTime`, `validateRegistration` in `services/admin-ui/src/hooks/use-api.ts` and `packages/shared-auth/src/validation.ts`.
- Use PascalCase for React components and exported classes: `SDLCAuth` in `packages/shared-auth/src/auth.ts`.
- Use snake_case only when language ecosystem expects it (Python); keep method names descriptive (`detect_and_mask` in `services/dlp/app/services/fast_pii_detector.py`).

**Variables:**
- Use camelCase for mutable variables and parameters in TS/JS (`requestID`, `cacheTTL`, `mockAuthGetUser`).
- Use UPPER_SNAKE_CASE for constants in Python and TS config contexts: `FAST_PII_PATTERNS` in `services/dlp/app/services/fast_pii_detector.py`.

**Types:**
- Use PascalCase for TypeScript interfaces/types (`ApiOptions`, `ValidationError`) in `services/admin-ui/src/hooks/use-api.ts` and `packages/shared-auth/src/validation.ts`.
- Use PascalCase struct names with snake_case JSON tags in Go (`LoginRequest`, `ResponseMeta`) in `services/gateway/internal/interfaces/http/handlers/auth.go`.

## Code Style

**Formatting:**
- Use Prettier where configured, but follow the nearest package-level config instead of assuming one global rule.
- `services/admin-ui/.prettierrc.json` enforces no semicolons, single quotes, trailing commas `all`, width 80.
- `packages/sdk-ts/.prettierrc` and `unified-platform/.prettierrc` enforce semicolons, single quotes, width 100.
- Python formatting/lint style is governed by Ruff config in `services/dlp/pyproject.toml` and `services/rag/pyproject.toml`.

**Linting:**
- Root lint in `package.json` is type-check-only (`npm run lint` -> `npm run typecheck`), so package-level lint configs are the true enforcement points.
- Use strict TS/React ESLint rules in `services/admin-ui/.eslintrc.json` (hooks rules, no-var, prefer-const, quote/semi rules).
- Use type-aware ESLint in `packages/sdk-ts/.eslintrc.js` (`@typescript-eslint/no-floating-promises`, optional-chain/nullish-coalescing preferences).
- Use Ruff in Python services with service-specific select/ignore sets in `services/dlp/pyproject.toml` and `services/rag/pyproject.toml`.

## Import Organization

**Order:**
1. Standard library / framework imports first (`react`, `encoding/json`, `os`).
2. Third-party dependencies second (`@supabase/supabase-js`, `github.com/go-chi/render`, `pytest` helpers).
3. Internal aliases/relative imports last (`@/store/auth`, `./types`, `app.services.fast_pii_metrics`).

**Path Aliases:**
- Root aliases are defined in `tsconfig.json`: `@/*`, `@sdlc/*`, and package aliases like `@sdlc/auth`.
- Local alias usage follows package conventions (`@/` in `services/admin-ui` and `packages/sdk-ts` configs).

## Error Handling

**Patterns:**
- TypeScript code primarily uses `try/catch` + `throw new Error(...)` for hard failures and fallbacks for recoverable flows, as in `packages/shared-auth/src/auth.ts` and `services/admin-ui/src/hooks/use-api.ts`.
- Go handlers use explicit `if err != nil` branching with HTTP status mapping via helper functions (`respondWithError`) in `services/gateway/internal/interfaces/http/handlers/auth.go`.
- Python services favor early returns for disabled/off-path behavior and explicit control flow, as in `services/dlp/app/services/fast_pii_detector.py`.

## Logging

**Framework:** Mixed by service (`logrus` in Go, `logging` in Python, `console` in TS/JS UI/shared code).

**Patterns:**
- Prefer structured logs with contextual fields in Go (`logrus.WithFields(...)`) as in `services/gateway/internal/interfaces/http/handlers/auth.go`.
- Use module-level logger objects in Python (`logger = logging.getLogger(__name__)`) as in `services/dlp/app/services/fast_pii_detector.py`.
- Client/shared TS code still uses `console.error`/`console.warn` in non-critical paths; avoid introducing additional noisy logs in hot paths (`packages/shared-auth/src/auth.ts`).

## Comments

**When to Comment:**
- Use intent-focused comments near non-obvious control flow, retry logic, fallback behavior, or security rationale (`services/admin-ui/src/hooks/use-api.ts`, `tests/e2e/auth-flow.spec.ts`).
- Use section-divider comments in tests for readability when suites are long (`services/dlp/tests/test_fast_pii_detector.py`).

**JSDoc/TSDoc:**
- Public classes/method groups often use JSDoc blocks in shared packages (`packages/shared-auth/src/auth.ts`).
- Python modules/classes use docstrings consistently in healthy modules (`services/dlp/app/services/fast_pii_detector.py`).
- Go uses exported symbol comments in handler files (`services/gateway/internal/interfaces/http/handlers/auth.go`).

## Function Design

**Size:** Prefer small focused utilities/hooks (for example `services/admin-ui/src/lib/utils.ts`), but existing modules include large service classes; new code should keep functions focused and compose helpers.

**Parameters:** Use typed parameter objects or explicit parameter typing over untyped values (`ApiOptions` in `services/admin-ui/src/hooks/use-api.ts`, typed structs in Go handlers).

**Return Values:** Use explicit return types for public utilities/services and return nullable/optional values intentionally (`Promise<SDLCUser | null>`, `string | null`, `list[PIIMatch]`).

## Module Design

**Exports:** Prefer named exports for utilities/config factories (`packages/test-config/src/index.ts`, `packages/shared-auth/src/validation.ts`); class exports are used for service-style modules (`SDLCAuth`).

**Barrel Files:** Barrel exports are used for package entrypoints/config composition (`packages/test-config/src/index.ts`, `packages/shared-auth/src/index.ts`).

---

*Convention analysis: 2026-04-22*
