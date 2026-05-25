# @finsavvyai/auth

A TypeScript authentication library with JWT signing/verification, RBAC (Role-Based Access Control), and middleware for Express and Hono frameworks.

## Features

- **JWT Management**: Sign and verify HS256 tokens with expiry handling
- **RBAC System**: Role hierarchy, permission management, and resource-based access control
- **Express Middleware**: `requireAuth()`, `requireRole()`, `requirePermission()` for Express.js
- **Hono Middleware**: Framework-agnostic middleware builders for Hono
- **Provider Support**: Clerk and Supabase authentication wrappers
- **Type Safety**: Full TypeScript with strict mode enabled
- **Lightweight**: All modules under 200 lines, optimized for tree-shaking

## Installation

```bash
npm install @finsavvyai/auth jsonwebtoken
npm install --save-dev typescript @types/jsonwebtoken vitest
```

## Quick Start

### JWT Signing & Verification

```typescript
import { signToken, verifyToken } from '@finsavvyai/auth';

const secret = 'your-secret-key';

// Sign token
const token = signToken(
  { sub: 'user-123', email: 'user@example.com', role: 'user' },
  secret,
  { expiresIn: '7d' }
);

// Verify token
const payload = verifyToken(token, secret);
console.log(payload.sub); // 'user-123'
```

### RBAC Permission Checks

```typescript
import { hasPermission } from '@finsavvyai/auth';

const user = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'user',
  permissions: [],
};

if (hasPermission(user, 'documents', 'write')) {
  // Allow operation
}
```

### Express Middleware

```typescript
import express from 'express';
import { requireAuth, requireRole } from '@finsavvyai/auth';

const app = express();
const secret = process.env.JWT_SECRET;

// Protect all routes after this
app.use(requireAuth(secret));

// Admin-only route
app.get('/admin', requireRole('admin'), (req, res) => {
  res.json({ message: `Hello ${req.user?.email}` });
});
```

### Hono Middleware

```typescript
import { Hono } from 'hono';
import { createAuthMiddleware, createRoleMiddleware } from '@finsavvyai/auth';

const app = new Hono();
const secret = process.env.JWT_SECRET;

// Protect routes
app.use(createAuthMiddleware(secret));

// Admin-only
app.get('/admin', createRoleMiddleware('admin'), (c) => {
  return c.json({ message: 'Admin only' });
});
```

### Clerk Integration

```typescript
import { initClerk } from '@finsavvyai/auth';

const clerk = initClerk({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
});

const user = await clerk.verifyToken(clerkToken);
```

### Supabase Integration

```typescript
import { createSupabaseAuth } from '@finsavvyai/auth';

const supabase = createSupabaseAuth({
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
});

const user = await supabase.verifyToken(supabaseToken);
```

## Architecture

```
src/
├── types.ts                    # Core types (AuthUser, TokenPayload, etc.)
├── index.ts                    # Barrel export
├── jwt/
│   ├── sign.ts                 # Token signing
│   └── verify.ts               # Token verification
├── rbac/
│   ├── permissions.ts          # Permission checking logic
│   └── roles.ts                # Role hierarchy and configs
├── middleware/
│   ├── types.ts                # Middleware types
│   ├── express.ts              # Express middleware
│   └── hono.ts                 # Hono middleware
└── providers/
    ├── clerk.ts                # Clerk provider
    └── supabase.ts             # Supabase provider
```

## Testing

Run tests with coverage:

```bash
npm test
npm run test:coverage
```

Test suites:
- `jwt.test.ts` - Token signing/verification (11 tests)
- `rbac.test.ts` - Permission and role checks (20+ tests)
- `middleware.express.test.ts` - Express middleware (12 tests)
- `middleware.hono.test.ts` - Hono middleware (9 tests)
- `providers.test.ts` - Clerk & Supabase (12 tests)

## Role Hierarchy

- **admin**: Full permissions on all resources
- **user**: Read, write, create on documents, settings; read on reports
- **guest**: Read-only on documents and public content

Custom permissions can be added to user objects:

```typescript
const customUser = {
  ...user,
  permissions: ['articles:publish', 'videos:create'],
};
```

## License

MIT
