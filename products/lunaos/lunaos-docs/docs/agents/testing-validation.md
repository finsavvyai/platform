# 🧪 Testing & Validation Agent

<Badge type="tip" text="Free" />

Expert testing specialist that generates comprehensive test suites — unit tests, integration tests, and E2E tests.

## When to Use

- Adding tests to existing code
- Generating test boilerplate for new features
- Improving test coverage
- Writing E2E test scenarios

## Capabilities

- **Unit tests** — Jest, Vitest, Mocha, pytest
- **Integration tests** — API testing, database testing
- **E2E tests** — Playwright, Cypress
- **Test fixtures** — Mock data, factory functions
- **Edge cases** — Boundary values, error paths, null handling

## CLI Usage

```bash
# Generate tests for a module
luna run testing-validation --context "$(cat src/services/auth.ts)"

# Generate tests for a React component
luna run testing-validation --context "$(cat src/components/LoginForm.tsx)"
```

## API Usage

```bash
curl -N -X POST https://api.lunaos.ai/agents/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "testing-validation",
    "context": "export function calculateDiscount(price: number, tier: string): number { ... }"
  }'
```

## Example Output

```typescript
import { describe, it, expect } from 'vitest';
import { calculateDiscount } from './pricing';

describe('calculateDiscount', () => {
  it('should return 0% discount for free tier', () => {
    expect(calculateDiscount(100, 'free')).toBe(100);
  });

  it('should apply 20% discount for pro tier', () => {
    expect(calculateDiscount(100, 'pro')).toBe(80);
  });

  it('should apply 40% discount for team tier', () => {
    expect(calculateDiscount(100, 'team')).toBe(60);
  });

  it('should handle zero price', () => {
    expect(calculateDiscount(0, 'pro')).toBe(0);
  });

  it('should handle unknown tier as no discount', () => {
    expect(calculateDiscount(100, 'enterprise')).toBe(100);
  });

  it('should handle negative prices', () => {
    expect(() => calculateDiscount(-10, 'pro')).toThrow();
  });
});
```
