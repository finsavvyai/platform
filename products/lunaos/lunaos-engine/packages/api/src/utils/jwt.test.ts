import { describe, it, expect } from 'vitest';
import { signJWT, verifyJWT } from './jwt';

const TEST_SECRET = 'test-secret-key-for-unit-tests-32chars!!';

describe('JWT utilities', () => {
  it('signs and verifies a JWT', async () => {
    const payload = { sub: 'user-123', email: 'test@example.com', tier: 'free' };
    const token = await signJWT(payload, TEST_SECRET, 1);

    const decoded = await verifyJWT(token, TEST_SECRET);
    expect(decoded.sub).toBe('user-123');
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.tier).toBe('free');
  });

  it('includes expiration claim', async () => {
    const payload = { sub: 'user-456', email: 'exp@test.com', tier: 'free' };
    const token = await signJWT(payload, TEST_SECRET, 1);

    const decoded = await verifyJWT(token, TEST_SECRET);
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('rejects tampered tokens', async () => {
    const token = await signJWT({ sub: 'user-789', email: 'tamper@test.com', tier: 'free' }, TEST_SECRET, 1);
    const tampered = token.slice(0, -5) + 'XXXXX';

    await expect(verifyJWT(tampered, TEST_SECRET)).rejects.toThrow();
  });

  it('rejects tokens with wrong secret', async () => {
    const token = await signJWT({ sub: 'user-abc', email: 'wrong@test.com', tier: 'free' }, TEST_SECRET, 1);
    await expect(verifyJWT(token, 'wrong-secret-key-32chars-needed!!')).rejects.toThrow();
  });
});
