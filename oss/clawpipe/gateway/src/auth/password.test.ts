/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('hashPassword', () => {
  it('produces "salt:hash" hex format', async () => {
    const hashed = await hashPassword('hunter2');
    expect(hashed).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
  });

  it('two hashes of the same password differ (random salt)', async () => {
    const a = await hashPassword('p');
    const b = await hashPassword('p');
    expect(a).not.toBe(b);
  });
});

describe('verifyPassword', () => {
  it('returns true when password matches its hash', async () => {
    const hashed = await hashPassword('correct-horse');
    expect(await verifyPassword('correct-horse', hashed)).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hashed = await hashPassword('correct-horse');
    expect(await verifyPassword('wrong', hashed)).toBe(false);
  });

  it('returns false on malformed stored format (no colon)', async () => {
    expect(await verifyPassword('p', 'no-colon-here')).toBe(false);
  });

  it('returns false on empty stored', async () => {
    expect(await verifyPassword('p', '')).toBe(false);
  });

  it('returns false on missing hash half', async () => {
    expect(await verifyPassword('p', 'salt:')).toBe(false);
  });
});
