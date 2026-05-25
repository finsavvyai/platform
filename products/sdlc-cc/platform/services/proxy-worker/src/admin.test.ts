/**
 * Admin endpoint tests — HMAC verification + plan persistence round-trip.
 * Uses the same tiny in-process runner as rate-limiter.test.ts / monthly-quota.
 */

import { handleAdminSetPlan, verifyHmac } from './admin';
import { getTenantPlan, resolvePlan } from './tenant-plan';

class MemoryKV {
  private store = new Map<string, string>();
  async get(key: string, type?: 'json'): Promise<unknown> {
    const v = this.store.get(key);
    if (v === undefined) return null;
    return type === 'json' ? JSON.parse(v) : v;
  }
  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

interface TestCase { name: string; run: () => Promise<boolean>; }
const tests: TestCase[] = [];
let passed = 0;
let failed = 0;
function test(name: string, fn: () => Promise<boolean>) { tests.push({ name, run: fn }); }

async function signedReq(secret: string, body: unknown): Promise<Request> {
  const raw = JSON.stringify(body);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return new Request('https://api.sdlc.cc/admin/plans', {
    method: 'POST',
    headers: { 'X-Admin-Signature': `sha256=${hex}`, 'Content-Type': 'application/json' },
    body: raw,
  });
}

test('verifyHmac accepts a matching sha256 signature', async () => {
  const body = '{"hello":"world"}';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('s'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return verifyHmac('s', body, `sha256=${hex}`);
});

test('verifyHmac rejects wrong secret', async () => {
  return !(await verifyHmac('s', 'x', 'sha256=deadbeef'));
});

test('verifyHmac rejects missing sha256 prefix', async () => {
  return !(await verifyHmac('s', 'x', 'deadbeef'));
});

test('admin disabled when secret empty', async () => {
  const kv = new MemoryKV();
  const req = new Request('https://api.sdlc.cc/admin/plans', { method: 'POST' });
  const res = await handleAdminSetPlan(req, kv as unknown as KVNamespace, '');
  return res.status === 503;
});

test('admin rejects GET', async () => {
  const kv = new MemoryKV();
  const req = new Request('https://api.sdlc.cc/admin/plans', { method: 'GET' });
  const res = await handleAdminSetPlan(req, kv as unknown as KVNamespace, 'k');
  return res.status === 405;
});

test('admin rejects bad signature', async () => {
  const kv = new MemoryKV();
  const req = new Request('https://api.sdlc.cc/admin/plans', {
    method: 'POST',
    body: '{"userId":"u1","plan":"team"}',
    headers: { 'X-Admin-Signature': 'sha256=00' },
  });
  const res = await handleAdminSetPlan(req, kv as unknown as KVNamespace, 'k');
  return res.status === 401;
});

test('admin rejects invalid JSON even when signed', async () => {
  const req = await (async () => {
    const raw = 'not-json';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('k'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return new Request('https://api.sdlc.cc/admin/plans', {
      method: 'POST',
      headers: { 'X-Admin-Signature': `sha256=${hex}` },
      body: raw,
    });
  })();
  const res = await handleAdminSetPlan(req, new MemoryKV() as unknown as KVNamespace, 'k');
  return res.status === 400;
});

test('admin rejects missing userId/plan', async () => {
  const res = await handleAdminSetPlan(
    await signedReq('k', { plan: 'team' }),
    new MemoryKV() as unknown as KVNamespace,
    'k'
  );
  return res.status === 400;
});

test('admin rejects unknown plan name', async () => {
  const res = await handleAdminSetPlan(
    await signedReq('k', { userId: 'u1', plan: 'titanium' }),
    new MemoryKV() as unknown as KVNamespace,
    'k'
  );
  return res.status === 400;
});

test('admin persists plan for valid input', async () => {
  const kv = new MemoryKV();
  const res = await handleAdminSetPlan(
    await signedReq('k', { userId: 'u1', plan: 'team', source: 'webhook', reference: 'sub_123' }),
    kv as unknown as KVNamespace,
    'k'
  );
  if (res.status !== 200) return false;
  const stored = await getTenantPlan(kv as unknown as KVNamespace, 'u1');
  return stored?.plan === 'team' && stored.source === 'webhook' && stored.reference === 'sub_123';
});

test('resolvePlan prefers override over key-stored plan', async () => {
  const kv = new MemoryKV() as unknown as KVNamespace;
  await handleAdminSetPlan(
    await signedReq('k', { userId: 'u2', plan: 'enterprise' }),
    kv,
    'k'
  );
  const p = await resolvePlan(kv, 'u2', 'free');
  return p === 'enterprise';
});

test('resolvePlan falls back to key-stored plan when no override', async () => {
  const kv = new MemoryKV() as unknown as KVNamespace;
  const p = await resolvePlan(kv, 'nobody', 'startup');
  return p === 'startup';
});

test('resolvePlan defaults to free when both missing', async () => {
  const kv = new MemoryKV() as unknown as KVNamespace;
  const p = await resolvePlan(kv, 'nobody', undefined);
  return p === 'free';
});

async function runTests() {
  console.log('Running admin/tenant-plan tests...\n');
  for (const t of tests) {
    try {
      const ok = await t.run();
      if (ok) { console.log(`✅ ${t.name}`); passed += 1; }
      else { console.log(`❌ ${t.name}`); failed += 1; }
    } catch (err) {
      console.log(`❌ ${t.name} → ${err}`);
      failed += 1;
    }
  }
  console.log(`\n${passed}/${passed + failed} passed`);
  if (failed > 0) process.exit(1);
}

runTests();
