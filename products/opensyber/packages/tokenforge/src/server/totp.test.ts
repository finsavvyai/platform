import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTotp, verifyTotp, TotpLockedOutError, TOTP_MAX_ATTEMPTS, type TotpRateLimiter } from './totp.js';
import type { TokenForgeServerOptions } from '../shared/types.js';
import { MemoryStorage } from './storage/memory.js';

/** A well-known base32 secret for deterministic tests */
const TEST_SECRET = 'JBSWY3DPEHPK3PXP'; // decodes to "Hello!"

function makeOptions(
  secret: string | null = TEST_SECRET,
): TokenForgeServerOptions & { getTotpSecret: (uid: string) => Promise<string | null> } {
  return {
    storage: new MemoryStorage(),
    trustThresholds: { allow: 80, stepUp: 40 },
    sessionMaxAge: 86400,
    nonceExpiry: 60,
    getTotpSecret: vi.fn().mockResolvedValue(secret),
  };
}

describe('generateTotp', () => {
  it('produces a 6-digit code', async () => {
    const code = await generateTotp(TEST_SECRET, 1);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('produces deterministic output for same counter', async () => {
    const a = await generateTotp(TEST_SECRET, 12345);
    const b = await generateTotp(TEST_SECRET, 12345);
    expect(a).toBe(b);
  });

  it('produces different codes for different counters', async () => {
    const a = await generateTotp(TEST_SECRET, 100);
    const b = await generateTotp(TEST_SECRET, 101);
    expect(a).not.toBe(b);
  });

  it('pads short codes with leading zeros', async () => {
    // Generate many codes and verify all are exactly 6 chars
    const codes = await Promise.all(
      Array.from({ length: 20 }, (_, i) => generateTotp(TEST_SECRET, i)),
    );
    for (const code of codes) {
      expect(code).toHaveLength(6);
    }
  });
});

describe('verifyTotp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('succeeds with correct code for current time step', async () => {
    const now = 1700000000; // fixed epoch
    vi.setSystemTime(now * 1000);
    const counter = Math.floor(now / 30);
    const code = await generateTotp(TEST_SECRET, counter);

    const result = await verifyTotp(code, 'user-1', makeOptions());
    expect(result).toBe(true);

    vi.useRealTimers();
  });

  it('fails with wrong code', async () => {
    vi.setSystemTime(1700000000 * 1000);
    const result = await verifyTotp('000000', 'user-1', makeOptions());
    // Only fails if '000000' isn't the actual code; generate real one to confirm
    const now = 1700000000;
    const realCode = await generateTotp(TEST_SECRET, Math.floor(now / 30));
    if (realCode !== '000000') {
      expect(result).toBe(false);
    }
    vi.useRealTimers();
  });

  it('allows +1 time step tolerance (clock skew)', async () => {
    const now = 1700000000;
    vi.setSystemTime(now * 1000);

    // Generate code for previous step
    const prevCounter = Math.floor(now / 30) - 1;
    const prevCode = await generateTotp(TEST_SECRET, prevCounter);

    // Generate code for next step
    const nextCounter = Math.floor(now / 30) + 1;
    const nextCode = await generateTotp(TEST_SECRET, nextCounter);

    // Both should verify (tolerance window is offset -1, 0, +1)
    expect(await verifyTotp(prevCode, 'user-1', makeOptions())).toBe(true);
    expect(await verifyTotp(nextCode, 'user-1', makeOptions())).toBe(true);

    vi.useRealTimers();
  });

  it('fails when no getTotpSecret is configured', async () => {
    vi.setSystemTime(1700000000 * 1000);
    const opts = {
      storage: new MemoryStorage(),
      trustThresholds: { allow: 80, stepUp: 40 },
      sessionMaxAge: 86400,
      nonceExpiry: 60,
    } as TokenForgeServerOptions & { getTotpSecret?: undefined };

    const result = await verifyTotp('123456', 'user-1', opts);
    expect(result).toBe(false);
    vi.useRealTimers();
  });

  it('fails when secret is null for user', async () => {
    vi.setSystemTime(1700000000 * 1000);
    const result = await verifyTotp('123456', 'user-1', makeOptions(null));
    expect(result).toBe(false);
    vi.useRealTimers();
  });
});

describe('verifyTotp rate limiting', () => {
  function makeRateLimiter(): TotpRateLimiter & { attempts: Map<string, number> } {
    const attempts = new Map<string, number>();
    return {
      attempts,
      getFailedAttempts: vi.fn(async (uid: string) => attempts.get(uid) ?? 0),
      recordFailedAttempt: vi.fn(async (uid: string) => {
        attempts.set(uid, (attempts.get(uid) ?? 0) + 1);
      }),
      resetFailedAttempts: vi.fn(async (uid: string) => {
        attempts.delete(uid);
      }),
    };
  }

  it('records a failed attempt when the code is wrong', async () => {
    const limiter = makeRateLimiter();
    const opts = { ...makeOptions(), rateLimiter: limiter };
    const ok = await verifyTotp('000000', 'alice', opts);
    expect(ok).toBe(false);
    expect(limiter.attempts.get('alice')).toBe(1);
  });

  it('resets attempts on a successful verification', async () => {
    const limiter = makeRateLimiter();
    limiter.attempts.set('alice', 3);
    const now = Math.floor(Date.now() / 1000);
    const counter = Math.floor(now / 30);
    const validCode = await generateTotp(TEST_SECRET, counter);
    const opts = { ...makeOptions(), rateLimiter: limiter };
    const ok = await verifyTotp(validCode, 'alice', opts);
    expect(ok).toBe(true);
    expect(limiter.attempts.has('alice')).toBe(false);
  });

  it(`throws TotpLockedOutError once ${TOTP_MAX_ATTEMPTS} failed attempts accumulate`, async () => {
    const limiter = makeRateLimiter();
    limiter.attempts.set('alice', TOTP_MAX_ATTEMPTS);
    const opts = { ...makeOptions(), rateLimiter: limiter };
    await expect(verifyTotp('000000', 'alice', opts)).rejects.toBeInstanceOf(TotpLockedOutError);
  });

  it('still verifies normally when no rateLimiter is provided (back-compat)', async () => {
    const opts = makeOptions();
    const ok = await verifyTotp('000000', 'alice', opts);
    expect(ok).toBe(false); // wrong code, no limiter side-effects
  });
});

describe('base32 decode (via generateTotp)', () => {
  it('handles known test vector JBSWY3DPEHPK3PXP', async () => {
    // This secret is well-known; just ensure it produces a valid code
    const code = await generateTotp('JBSWY3DPEHPK3PXP', 0);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('handles secret with padding characters', async () => {
    const code = await generateTotp('JBSWY3DPEHPK3PXP====', 0);
    const codeNoPad = await generateTotp('JBSWY3DPEHPK3PXP', 0);
    expect(code).toBe(codeNoPad);
  });

  it('handles lowercase input', async () => {
    const upper = await generateTotp('JBSWY3DPEHPK3PXP', 42);
    const lower = await generateTotp('jbswy3dpehpk3pxp', 42);
    expect(upper).toBe(lower);
  });
});
