# TokenForge + Next.js Example

Two integration patterns for Next.js App Router:

## Pattern 1: Route Handler Wrapper

Wrap individual API routes with `withTokenForge`:

```
app/api/profile/route.ts  ← see route.ts
```

Best for: per-route configuration, different trust thresholds per endpoint.

## Pattern 2: Edge Middleware

Check all requests in Next.js middleware:

```
middleware.ts  ← see middleware.ts
```

Best for: global protection, consistent trust scoring across all API routes.

## Setup

```bash
npm install @opensyber/tokenforge
```

## Client-Side Setup

```tsx
// app/providers.tsx
'use client';

import { TokenForgeProvider } from '@opensyber/tokenforge/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TokenForgeProvider config={{
      apiBase: '/api',
      getSessionId: () => document.cookie.match(/session=([^;]+)/)?.[1] ?? null,
    }}>
      {children}
    </TokenForgeProvider>
  );
}
```
