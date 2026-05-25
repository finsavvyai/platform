import { describe, it, expect } from 'vitest';
import {
  signupSchema,
  loginSchema,
  agentExecuteSchema,
  createApiKeySchema,
  checkoutSchema,
  ragIndexSchema,
  ragSearchQuerySchema,
} from './index';

describe('signupSchema', () => {
  it('validates correct signup data', () => {
    const result = signupSchema.safeParse({ email: 'user@test.com', password: 'securepass', name: 'Test' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = signupSchema.safeParse({ email: 'not-email', password: 'securepass' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = signupSchema.safeParse({ email: 'user@test.com', password: '123' });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('validates correct login data', () => {
    const result = loginSchema.safeParse({ email: 'user@test.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({ email: 'user@test.com' });
    expect(result.success).toBe(false);
  });
});

describe('agentExecuteSchema', () => {
  it('validates minimal execute request', () => {
    const result = agentExecuteSchema.safeParse({ agent: 'code-review', context: 'Review this code' });
    expect(result.success).toBe(true);
  });

  it('validates with optional fields', () => {
    const result = agentExecuteSchema.safeParse({
      agent: 'code-review',
      context: 'Review this',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      useRag: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing agent', () => {
    const result = agentExecuteSchema.safeParse({ context: 'Review this' });
    expect(result.success).toBe(false);
  });
});

describe('checkoutSchema', () => {
  it('accepts pro plan', () => {
    expect(checkoutSchema.safeParse({ plan: 'pro' }).success).toBe(true);
  });

  it('accepts team plan', () => {
    expect(checkoutSchema.safeParse({ plan: 'team' }).success).toBe(true);
  });
});

describe('ragIndexSchema', () => {
  it('validates file array', () => {
    const result = ragIndexSchema.safeParse({
      files: [{ path: 'src/index.ts', content: 'console.log("hi")' }],
      repoName: 'my-repo',
    });
    expect(result.success).toBe(true);
  });
});

describe('ragSearchQuerySchema', () => {
  it('validates search query', () => {
    const result = ragSearchQuerySchema.safeParse({ q: 'authentication middleware' });
    expect(result.success).toBe(true);
  });

  it('rejects empty query', () => {
    const result = ragSearchQuerySchema.safeParse({ q: '' });
    expect(result.success).toBe(false);
  });
});
