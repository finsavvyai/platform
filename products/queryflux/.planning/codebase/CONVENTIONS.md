# Coding Conventions

**Analysis Date:** 2026-05-23

## Naming Patterns

**Files:**
- Components: PascalCase — `ConnectionStatusIndicator.tsx`, `VoiceTranscriptPanel.tsx`
- Hooks: camelCase with `use` prefix — `useConnections.ts`, `useVoiceRecognition.ts`, `useSubscriptionManagement.ts`
- Services/APIs: camelCase — `connection-api.ts`, `nlp-api.ts`, `query-api.ts`
- Stores: camelCase — `connectionStore.ts`, `queryStore.ts`, `uiStore.ts`
- Types/Interfaces: PascalCase — `ConnectionConfig`, `VoiceCommandResult`, `SubscriptionPlan`
- Test files: Same name as source with `.test.ts`, `.test.tsx`, or `.spec.ts` suffix — `connectionStore.test.ts`, `App.test.tsx`

**Functions:**
- Component functions: PascalCase — `ConnectionStatusIndicator()`, `InviteMembersForm()`
- Hooks: camelCase with `use` prefix — `useConnections()`, `useVoiceRecognition()`
- Service methods: camelCase — `create()`, `getById()`, `update()`, `delete()`
- Utilities/helpers: camelCase — `isTeamAtCapacity()`, `getStatusColor()`, `formatPrice()`
- Factory functions: camelCase — `makeConnection()` (pattern seen in tests)

**Variables:**
- State variables: camelCase — `transcript`, `isListening`, `activeConnectionId`, `connectionStatuses`
- Constants in UPPERCASE: `BASE_URL`, `PLAN_ICONS`, `FEATURE_NAMES`, `SUPPORTED_LANGUAGES`
- Private/underscore prefix for unused parameters: `_onUpgrade`, `_tenantId` (per ESLint rule)

**Types:**
- Interfaces: PascalCase — `ConnectionState`, `VoiceIntent`, `PlanCardProps`
- Union types: PascalCase — `DatabaseType`, `Language`, `Template`
- Zod schemas: PascalCase with `Schema` suffix — `DatabaseTypeSchema`, `ConnectionConfigSchema`

## Code Style

**Formatting:**
- Tool: Prettier 3.1.0 (installed, no config file — uses defaults)
- Default formatting: 80-char line length, semicolons, single quotes, trailing commas
- Auto-format: Run via IDE integration or pre-commit hook (none currently active)

**Linting:**
- Tool: ESLint 9.39.3 with TypeScript support
- Config: `eslint.config.js` (flat config format, modern ESLint v9+)
- Key rules:
  - `@typescript-eslint/no-explicit-any`: OFF (allows `any` type usage)
  - `@typescript-eslint/no-unused-vars`: ERROR with `argsIgnorePattern: '^_'` (unused params prefixed with `_`)
  - `react-refresh/only-export-components`: WARN (allow constant exports in components)
  - `react-hooks/recommended`: Enforced (React hooks dependencies checked)

**Language Targets:**
- ECMAScript version: ES2020
- JSX: `react-jsx` (automatic JSX runtime, no React import needed)
- Module system: ESNext with `"type": "module"` in package.json

## Import Organization

**Order:**
1. External library imports (react, react-router, zustand, axios, etc.)
2. Internal service imports (`src/services/`, `src/api/`)
3. Internal store/hook imports (`src/stores/`, `src/hooks/`)
4. Internal type imports (`src/types/`, `src/contracts/`)
5. Relative imports (`./*`, `../*`)
6. Type-only imports: `import type { ... }` (separate from value imports)

**Path Aliases:**
- `@/*` → `src/*` (configured in vite.config.ts and tsconfig.app.json)
- Used throughout codebase: `@/services/api`, `@/hooks/useConnections`, `@/types/api`

**Example:**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { authAPI } from '../services/auth-api';
import { useConnectionStore } from '../stores/connectionStore';
import type { ConnectionConfig, ConnectionStatus } from '../types/api';
```

## Error Handling

**Patterns:**
- Throw errors explicitly: `throw new Error('Query not found: ${id}')`
- No silent failures or swallowed exceptions
- Error propagation up to handler (component or API boundary)
- Type safety with custom error types where applicable

**React Components:**
- No try/catch at component level; errors bubble via error boundary (not yet implemented in codebase)
- API calls wrapped in hooks that handle `error` state (e.g., `useConnections` sets error on failure)

**Services/API:**
- Async functions reject with Error objects: `reject(new Error('message'))`
- Example from `api-services-query.ts`: `if (!ws) throw new Error('WebSocket not connected')`

**No Result Pattern Detected:** Codebase uses standard Promise rejection + null checks, not explicit `Result<Data, Error>` types currently.

## Logging

**Framework:** console object (no structured logging framework detected)

**Patterns:**
- No logging infrastructure currently in frontend (React code)
- Backend has Pino logger integration (dev dependencies include `pino`, `pino-http`, `pino-pretty`)
- Console logging appears absent from reviewed src/ files (clean production code)

## Comments

**When to Comment:**
- JSDoc/TSDoc for all public functions and exported types
- Brief inline comments for complex logic or non-obvious intent
- File headers with purpose statement (seen in components: `/** Voice Recognition Hook ... */`)

**JSDoc/TSDoc:**
- Used consistently in services: `/** Create new query. */`, `/** Get query by ID. */`
- Parameter and return types documented in function signatures
- Example from `api/queries.ts`:
```typescript
/**
 * Query CRUD operations API.
 */
export interface QueryRepository {
  create(query: VisualQuery): Promise<VisualQuery>;
  getById(id: string): Promise<VisualQuery | null>;
}
```

## Function Design

**Size:** Maximum 200 lines per file (per CLAUDE.md)
- React components: Split complex logic into custom hooks
- Services: Break large operations into separate methods
- Examples of appropriate split: `useSubscriptionManagement.ts` (200 lines) broken into hooks + utils

**Parameters:**
- Prefer props objects over multiple positional parameters in React components
- Example: `interface PlanCardProps { plan, isCurrentPlan?, onSelect }` instead of `PlanCard(plan, current, select)`
- Type all function parameters explicitly (no implicit `any`)

**Return Values:**
- Async functions return Promises with typed payloads: `Promise<ConnectionConfig | null>`
- Null for missing/not-found states (not undefined)
- Objects/arrays for collections, never null for empty collections

## Module Design

**Exports:**
- Named exports for functions, types, interfaces: `export const useConnections = ...`
- Default exports for React components (Vite default)
- Type-only exports: `export type { ConnectionConfig }` or `export type { ... } from './api-responses'`

**Barrel Files:**
- Used in `src/types/api.ts`: re-exports from `api-responses.ts`
- Pattern: `export type { Type1, Type2 } from './api-responses'`

**Component Props Pattern:**
- Define `interface [ComponentName]Props` above component
- Destructure props in function signature
- Example: `export function PlanCard({ plan, isCurrentPlan, onSelect }: PlanCardProps)`

## State Management

**Zustand Stores:**
- Location: `src/stores/` (connectionStore.ts, queryStore.ts, uiStore.ts)
- Pattern: `create<State>()(persist(...))`
- Store structure: State interface defines both state properties and action methods
- Persistence middleware: `persist()` with `name` and `partialize` options
- Immutable updates: `set((state) => ({ ... }))`
- Selectors: `useConnectionStore.getState()` for direct access, or hooks for subscriptions

**Example from `src/stores/connectionStore.ts`:**
```typescript
interface ConnectionState {
  connections: ConnectionConfig[];
  activeConnectionId: string | null;
  setConnections: (connections: ConnectionConfig[]) => void;
  addConnection: (connection: ConnectionConfig) => void;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connections: [],
      setConnections: (conns) => set({ connections: conns }),
      addConnection: (conn) => set((state) => ({
        connections: [...state.connections, conn]
      })),
    }),
    { name: 'queryflux-connections' }
  )
);
```

## React Patterns

**Hooks:**
- All components are functional with hooks
- Custom hooks extract reusable logic: `useConnections`, `useVoiceRecognition`, `useSubscriptionManagement`
- Hooks use React Query for async data: `@tanstack/react-query`

**Styling:**
- Tailwind CSS + class-variance-authority (CVA) for component variants
- Theme context for dynamic color/style values: `useTheme()` returns `{ theme: { colors: {...} } }`
- Dark mode support built-in via theme context

**Types in Components:**
- Props defined as interfaces: `interface VoiceTranscriptPanelProps { transcript, interimTranscript, lastResult }`
- Strict TypeScript enabled: `noImplicitAny: true`, `strictNullChecks: true`

## Commit Conventions

**Format:** Conventional Commits (observed from git log)

**Types:**
- `feat:` New feature — `feat: Implement Security Hardening (Task 13.2)`
- `fix:` Bug fix — (not seen in recent history)
- `refactor:` Code refactoring — `refactor(quick-1-01): split 4 oversized files under 200-line limit`
- `chore:` Maintenance — `chore: consolidate monorepo - add sibling sub-projects + portfolio docs`
- `docs:` Documentation (implied, not seen recently)

**Scope (optional):**
- Feature area or task ID: `(quick-1-01)`, `(13.2)`, `(Task 11.2 Frontend)`
- Task numbering from product roadmap

**Message:**
- Descriptive, concise (one line title)
- Link task ID or feature name when applicable
- Examples:
  - `feat: Implement Voice Command Processing Engine (Task 9.2)`
  - `refactor(quick-1-01): split 4 oversized files under 200-line limit`

---

*Convention analysis: 2026-05-23*
