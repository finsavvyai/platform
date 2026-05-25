# @shared/auth

Unified authentication system for all Enterprise AI Stack products.

## Features

- Single sign-on across all products
- Supabase integration
- Bundle access control
- Subscription management
- Organization support

## Usage

```typescript
import { UnifiedAuth } from '@shared/auth';

const auth = new UnifiedAuth({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_KEY!
});

// Login
const user = await auth.login('user@example.com', 'password');

// Check product access
const hasAccess = await auth.hasAccess(user.id, 'sdlc');

// Check bundle feature
const hasFeature = await auth.hasFeature(user.id, 'cross_product_analytics');
```

## Installation

```bash
npm install @shared/auth
```
