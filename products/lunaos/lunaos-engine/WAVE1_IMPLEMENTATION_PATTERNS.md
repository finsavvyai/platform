# Wave 1 Implementation Patterns & Conventions

This document describes the architectural patterns and coding conventions established in Wave 1 for the Luna-OS Engine.

---

## 1. Factory Pattern

All major modules use the factory pattern for instantiation.

### Payment Provider Factory
```typescript
// src/payment/provider.ts
export function createPaymentProvider(
  type: 'lemonsqueezy',
  config: PaymentConfig
): PaymentProvider {
  if (type === 'lemonsqueezy') {
    return new LemonSqueezyProvider(config);
  }
  throw new Error(`Unknown payment provider: ${type}`);
}
```

**Usage:**
```typescript
const provider = createPaymentProvider('lemonsqueezy', {
  apiKey: process.env.LEMONSQUEEZY_API_KEY,
  storeId: process.env.LEMONSQUEEZY_STORE_ID,
});

const session = await provider.checkout('pro', userId);
```

### Auth Provider Factory
```typescript
// src/auth/provider.ts
export function createAuthProvider(secret?: string): JwtAuthProvider {
  return new JwtAuthProvider(secret);
}
```

### Logger Factory
```typescript
// src/monitoring/index.ts
export function createLogger(context: string): Logger {
  return new Logger(context);
}
```

---

## 2. Type-First Development

All modules define types/interfaces first, then implementations.

### Pattern
```typescript
// types.ts — Define the contract
export interface PaymentProvider {
  checkout(planId: string, userId: string): Promise<CheckoutSession>;
  handleWebhook(signature: string, body: string): Promise<WebhookEvent>;
}

export interface CheckoutSession {
  checkoutId: string;
  checkoutUrl: string;
  planId: string;
  userId: string;
  createdAt: Date;
}

// provider.ts — Implement the contract
export class LemonSqueezyProvider implements PaymentProvider {
  async checkout(planId: string, userId: string): Promise<CheckoutSession> {
    // Implementation
  }
}
```

**Benefits:**
- Decoupled interfaces from implementations
- Easy to test with mocks
- Clear contracts between modules
- Supports multiple provider implementations

---

## 3. Environment Configuration

Configuration is sourced from `.env`, with defaults where appropriate.

### Pattern
```typescript
// src/payment/provider.ts
constructor(config: PaymentConfig) {
  if (!config.apiKey) throw new Error('LemonSqueezy API key required');
  this.apiKey = config.apiKey;
}

// Usage
const provider = createPaymentProvider('lemonsqueezy', {
  apiKey: process.env.LEMONSQUEEZY_API_KEY || 'default',
  storeId: process.env.LEMONSQUEEZY_STORE_ID,
});
```

**Environment Variables:**
```
# Required
LEMONSQUEEZY_API_KEY
LEMONSQUEEZY_STORE_ID
JWT_SECRET

# Optional with defaults
LEMONSQUEEZY_WEBHOOK_SECRET
LEMONSQUEEZY_VARIANT_FREE=1
LEMONSQUEEZY_VARIANT_PRO=2
LEMONSQUEEZY_VARIANT_ENTERPRISE=3
```

---

## 4. Error Handling

Custom error classes for different error conditions.

### Pattern
```typescript
// src/auth/types.ts
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// src/auth/middleware.ts
if (!authContext.isAuthenticated) {
  throw new UnauthorizedError('Missing authorization header');
}

if (!roles.includes(authContext.user.role)) {
  throw new ForbiddenError('Insufficient permissions');
}
```

**Benefits:**
- Specific error handling in middleware
- HTTP status code mapping
- Clear error semantics

---

## 5. Test Fixtures

Reusable factory functions for test data.

### Pattern
```typescript
// tests/fixtures/index.ts
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    role: 'user',
    subscriptionPlan: 'free',
    createdAt: faker.date.past(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// tests/auth.test.ts
it('should preserve user role in token', () => {
  const user = createMockUser({ role: 'admin' });
  const token = authProvider.signToken(user);
  const payload = authProvider.verifyToken(token);

  expect(payload.role).toBe('admin');
});
```

**Benefits:**
- Consistent test data
- Easy to customize per test
- Reduces test setup code
- Faker.js for realistic data

---

## 6. Structured Logging

JSON-structured logging for observability.

### Pattern
```typescript
// src/monitoring/index.ts
info(message: string, data?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: 'INFO',
      context: this.context,
      message,
      data,
      timestamp: new Date().toISOString(),
    })
  );
}

// Usage
const logger = createLogger('PaymentService');
logger.info('Checkout created', { checkoutId: 'abc123', userId: 'user1' });

// Output
// {"level":"INFO","context":"PaymentService","message":"Checkout created","data":{"checkoutId":"abc123","userId":"user1"},"timestamp":"2026-03-20T..."}
```

**Benefits:**
- Machine-parseable logs
- Consistent format across services
- Easy to parse in log aggregation tools
- Context preserved in every log

---

## 7. Middleware Pattern (Hono)

Auth middleware for protecting routes.

### Pattern
```typescript
// src/auth/middleware.ts
export function createAuthMiddleware(authProvider: JwtAuthProvider) {
  return async (context: Context, next: Next) => {
    const authHeader = context.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing authorization header');
    }

    const token = authHeader.substring(7);
    const payload = authProvider.verifyToken(token);

    (context as any).authContext = {
      user: { /* ... */ },
      token,
      isAuthenticated: true,
    };

    await next();
  };
}

// In API routes
app.post(
  '/checkout',
  createAuthMiddleware(authProvider),
  requireSubscription(['pro', 'enterprise']),
  checkoutHandler
);
```

**Benefits:**
- Composable middleware
- Dependency injection friendly
- Type-safe context
- Clear authorization rules

---

## 8. Test Organization

Tests organized by concern with descriptive labels.

### Pattern
```typescript
// tests/auth.test.ts
describe('JWT Authentication Provider', () => {
  let authProvider: ReturnType<typeof createAuthProvider>;

  beforeEach(() => {
    authProvider = createAuthProvider(mockEnv.JWT_SECRET);
  });

  it('should sign and verify token', () => {
    const user = createMockUser();
    const token = authProvider.signToken(user);

    expect(token).toBeDefined();

    const payload = authProvider.verifyToken(token);
    expect(payload.userId).toBe(user.id);
  });

  it('should throw error for invalid token', () => {
    expect(() => authProvider.verifyToken('invalid-token')).toThrow(
      'Invalid or expired token'
    );
  });
});
```

**Benefits:**
- Clear test hierarchy
- Fixture setup in beforeEach
- Descriptive test names
- Easy to add new test cases

---

## 9. Configuration Management

Plans and variants managed in dedicated modules.

### Pattern
```typescript
// src/payment/plans.ts
export const PLANS: Record<PlanType, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    features: ['5 workflows', '100 monthly runs', ...],
    variantId: process.env.LEMONSQUEEZY_VARIANT_FREE || '1',
  },
  pro: { /* ... */ },
  enterprise: { /* ... */ },
};

export function getPlan(planId: PlanType): Plan {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Plan not found: ${planId}`);
  return plan;
}
```

**Benefits:**
- Single source of truth for plans
- Easy to add/modify plans
- Type-safe plan access
- Variant IDs centralized

---

## 10. Line Length and Module Boundaries

Each file ≤200 lines, with clear responsibility.

### Module Breakdown
```
src/payment/
├── provider.ts    (95 lines)  — Provider implementation
├── types.ts       (58 lines)  — Interfaces and types
├── plans.ts       (63 lines)  — Plan definitions
└── webhook.ts     (37 lines)  — Webhook handling

src/auth/
├── provider.ts    (61 lines)  — JWT provider
├── types.ts       (49 lines)  — Auth types
└── middleware.ts  (77 lines)  — Hono middleware
```

**Guidelines:**
- One class/function per file when possible
- Group related types in `types.ts`
- Separate concerns into different files
- Keep files lean and focused

---

## Testing Checklist

Before merging new Wave modules:

- [ ] All test files created and passing
- [ ] Coverage ≥95% (enforced via vitest.config.ts)
- [ ] Each file ≤200 lines
- [ ] TypeScript strict mode
- [ ] Error handling tested
- [ ] Edge cases covered
- [ ] Fixtures reusable across tests
- [ ] Environment variables documented
- [ ] README.md updated with examples

---

## Next Wave Conventions

Maintain these patterns in Wave 2+:

1. **Factory patterns** for all service instantiation
2. **Type-first development** with interfaces
3. **Structured logging** with context
4. **Custom errors** for different failure modes
5. **Test fixtures** for reusable test data
6. **Environment-based configuration** via .env
7. **Middleware composition** for Hono routes
8. **≤200 lines per file** strict limit
9. **95% coverage threshold** on all modules
10. **Descriptive test organization** with beforeEach setup

---

## Integration with Hono Example

```typescript
// packages/api/src/index.ts
import { Hono } from 'hono';
import { createAuthProvider } from '../../src/auth/provider';
import { createPaymentProvider } from '../../src/payment/provider';
import { createLogger } from '../../src/monitoring';
import { createAuthMiddleware } from '../../src/auth/middleware';

const app = new Hono();

// Initialize services
const authProvider = createAuthProvider(process.env.JWT_SECRET);
const paymentProvider = createPaymentProvider('lemonsqueezy', {
  apiKey: process.env.LEMONSQUEEZY_API_KEY,
  storeId: process.env.LEMONSQUEEZY_STORE_ID,
});
const logger = createLogger('API');

// Health check
app.get('/health', async context => {
  logger.info('Health check');
  return context.json({ status: 'ok' });
});

// Protected routes
app.post(
  '/api/checkout',
  createAuthMiddleware(authProvider),
  async context => {
    const authContext = (context as any).authContext;
    const { planId } = await context.req.json();

    try {
      const session = await paymentProvider.checkout(planId, authContext.user.id);
      logger.info('Checkout created', { planId, userId: authContext.user.id });
      return context.json(session);
    } catch (error) {
      logger.error('Checkout failed', error as Error);
      return context.json({ error: 'Checkout failed' }, 400);
    }
  }
);

export default app;
```

---

**End of Implementation Patterns Document**
