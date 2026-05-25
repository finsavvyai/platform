# Coding Conventions

**Analysis Date:** 2026-04-21

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `Button.tsx`, `AlertCard.tsx`, `Sidebar.tsx`)
- Pages: PascalCase (e.g., `Dashboard.tsx`, `RiskAssessment.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useApi.ts`, `useDebounce.ts`)
- Utils/helpers: camelCase (e.g., `auth.ts`, `formatting.ts`)
- Tests: Named after source file with `.test.tsx` or `.test.ts` suffix (e.g., `Button.test.tsx`, `useApi.test.ts`)
- Context: PascalCase with `Context` suffix (e.g., `AuthContext.ts`)

**Functions:**
- All functions use camelCase: `fetchData()`, `handleClick()`, `getUserName()`
- React components are PascalCase: `Button`, `AlertCard`, `Sidebar`
- Event handlers use `on` prefix: `onClick`, `onClose`, `onNavigate`
- Callback/handler variables use `handle` prefix: `handleClick`, `handleSubmit`
- Internal functions within hooks use camelCase: `fetchFn()`, `setLoading()`

**Variables:**
- Local variables: camelCase (e.g., `userData`, `isLoading`, `alertCount`)
- Constants: camelCase in files, UPPERCASE in rare cases for magic numbers
- Boolean flags: prefix with `is`, `has`, `can`, `should`: `isOpen`, `hasError`, `canDelete`
- State variables: camelCase (e.g., `const [collapsed, setCollapsed] = useState(false)`)
- Destructured props: camelCase matching prop interface keys

**Types:**
- Interfaces: PascalCase without prefix (e.g., `ButtonProps`, `AlertCardProps`, `SidebarProps`)
- Enums: PascalCase (e.g., `AlertStatus`, `RiskLevel`)
- Type aliases: PascalCase (e.g., `Entity`, `Alert`, `User`)

## Code Style

**Formatting:**
- No Prettier config detected; project uses default ESLint formatting
- Indentation: 2 spaces (inferred from codebase style)
- Line length: No strict enforcer, but files kept compact (target max 200 lines per file)
- Quotes: Single quotes for strings (`'string'` not `"string"`)
- Semicolons: Required at end of statements
- Trailing commas: Used in multi-line objects/arrays

**Linting:**
- Tool: ESLint with TypeScript parser
- Config: `.eslintrc.json`
- Key rules disabled: `no-unused-vars`, `no-undef` (handled by TypeScript)
- Parser: `@typescript-eslint/parser`
- Environment: Browser, ES2021, Node

**Example ESLint config (`src/.eslintrc.json`):**
```json
{
  "env": { "browser": true, "es2021": true, "node": true },
  "extends": ["eslint:recommended"],
  "parser": "@typescript-eslint/parser",
  "rules": {
    "no-unused-vars": "off",
    "no-undef": "off"
  }
}
```

## Import Organization

**Order:**
1. React and framework imports (`import React from 'react'`)
2. Third-party library imports (`import { motion } from 'framer-motion'`, `import { X } from 'lucide-react'`)
3. Internal component/module imports (relative paths: `import { Button } from '../Button'`)
4. Type imports (at appropriate position or grouped at top)

**Path Aliases:**
- `@/` resolves to `src/` directory
- Used in imports: `import { useAuth } from '@/context/AuthContext'`
- Configured in `vite.config.ts` and `tsconfig.json`

**Example import pattern:**
```typescript
import React from 'react'
import { motion } from 'framer-motion'
import { X, ChevronsLeft } from 'lucide-react'
import clsx from 'clsx'
import { Avatar } from '../ui/Avatar'
import { useAuth } from '@/context/AuthContext'
import type { Alert } from '@/types'
```

## Error Handling

**Patterns:**
- Errors in hooks are typed as `Error | null` in state
- When catching unknown types, convert to Error: `err instanceof Error ? err : new Error(String(err))`
- Try-catch used in async operations within useEffect
- Promise `.catch()` chains convert unknown errors to Error type
- Component-level: error state tracked in useState, displayed conditionally
- Network errors: converted to Error type with message preservation

**Example from `useApi.ts`:**
```typescript
const [error, setError] = useState<Error | null>(null)

fetchFn()
  .catch((err) => {
    if (mounted) setError(err instanceof Error ? err : new Error(String(err)))
  })
```

**Example from hook tests:**
```typescript
it('converts non-Error objects to Error', async () => {
  const fetchFn = vi.fn().mockRejectedValue('string error')
  const { result } = renderHook(() => useApi(fetchFn))
  
  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })
  
  expect(result.current.error).toBeInstanceOf(Error)
  expect(result.current.error?.message).toBe('string error')
})
```

## Logging

**Framework:** Native `console` object (no logging library detected)

**Patterns:**
- Minimal logging in source code; most logging occurs in tests
- Debug logging not widely used; components rely on React DevTools
- No centralized logger; console methods not found in main components
- Error logging: typically captured in error state and displayed in UI
- Network logging: implicit through browser DevTools Network tab

## Comments

**When to Comment:**
- Rarely used; code is expected to be self-documenting
- Comments appear for non-obvious logic or complex math
- No JSDoc/TSDoc pattern detected; interfaces and functions rely on TypeScript inference

**Observed pattern:** Comments are minimal; type definitions provide documentation

## Function Design

**Size:** 
- Target maximum 200 lines per file per CLAUDE.md rules
- Files like `Button.tsx` (~50 lines), `useApi.ts` (~30 lines), `AlertCard.tsx` (~70 lines) follow this guideline
- Refactor when component logic exceeds ~100 lines

**Parameters:**
- Props passed as single object parameter, destructured in function signature
- Hooks accept dependencies array as second parameter: `useApi(fetchFn, [id])`
- Event handlers accept event object or explicit parameters

**Return Values:**
- Components return JSX.Element or ReactNode
- Hooks return object with state + methods: `{ data, loading, error, refetch }`
- Utils return typed values matching function signature
- Promise-based functions return: `Promise<T>` with proper error typing

**Example from `useApi.ts`:**
```typescript
export function useApi<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = []
) {
  // ... implementation
  return { data, loading, error, refetch: () => fetchFn() }
}
```

## Module Design

**Exports:**
- Named exports for all components: `export function Button({ ... })`
- Interfaces/types exported as named exports: `export interface ButtonProps { ... }`
- No default exports in components (all named exports)
- Hooks exported as named exports: `export function useApi<T>(...) { ... }`

**Barrel Files:**
- Not detected; each component/hook imported directly from its file
- Path aliases (`@/`) used to simplify import paths
- Example: Import from specific file rather than index: `import { useAuth } from '@/context/AuthContext'`

## TypeScript Usage

**Strict Mode:**
- TypeScript config: `"strict": true`, `"noImplicitAny": true`
- All functions have explicit parameter and return types
- Component props typed with interfaces: `interface ButtonProps { ... }`
- Generic types used for reusable hooks: `export function useApi<T>(...)`
- Type guards used for error handling: `err instanceof Error`

**Example from Button component:**
```typescript
interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit'
}

export function Button({
  children, variant = 'primary', size = 'md',
  disabled, onClick, className, type = 'button',
}: ButtonProps) {
  // ...
}
```

## Component Patterns

**Functional Components:** All components are functional with hooks, no class components

**Props Pattern:** 
- Single object parameter with interface definition
- Destructure props in function signature
- Optional props use `?` in interface and default values in destructuring

**State Management:**
- `useState` for local component state
- Context for app-wide state (e.g., `AuthContext`)
- Custom hooks for data fetching and side effects

**Styling:**
- Tailwind CSS classes applied via `clsx` utility
- Inline style objects for dynamic values: `style={{ color: 'var(--dash-text)' }}`
- CSS variables used for theming: `var(--dash-border)`, `var(--dash-text)`
- Motion animations via Framer Motion library

---

*Convention analysis: 2026-04-21*
