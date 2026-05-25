/**
 * Monthly Quota Tests — same lightweight harness as rate-limiter.test.ts
 * so it runs via plain `tsx src/monthly-quota.test.ts` with no test framework.
 */

import {
  MONTHLY_QUOTAS,
  QuotaState,
  QuotaStorage,
  checkAndConsumeQuota,
  monthKey,
  resetAtForMonth,
  tierFromPlan,
} from './monthly-quota';

class MemoryQuotaStorage implements QuotaStorage {
  private store = new Map<string, QuotaState>();
  async get(key: string): Promise<QuotaState | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, state: QuotaState): Promise<void> {
    this.store.set(key, state);
  }
  size(): number {
    return this.store.size;
  }
}

interface TestCase { name: string; run: () => Promise<boolean>; }
const tests: TestCase[] = [];
let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<boolean>) {
  tests.push({ name, run: fn });
}

test('monthKey emits zero-padded YYYYMM in UTC', async () => {
  const k = monthKey(new Date(Date.UTC(2026, 0, 5))); // Jan 2026
  return k === '202601';
});

test('resetAtForMonth points at first day of next UTC month', async () => {
  const r = resetAtForMonth(new Date(Date.UTC(2026, 0, 15)));
  return r === Date.UTC(2026, 1, 1, 0, 0, 0, 0);
});

test('tierFromPlan defaults to free for unknown / undefined', async () => {
  return tierFromPlan(undefined) === 'free' && tierFromPlan('hobby') === 'free';
});

test('tierFromPlan maps team/pro/startup → startup', async () => {
  return (
    tierFromPlan('team') === 'startup' &&
    tierFromPlan('Pro') === 'startup' &&
    tierFromPlan('startup') === 'startup'
  );
});

test('tierFromPlan recognizes enterprise (case-insensitive)', async () => {
  return tierFromPlan('Enterprise') === 'enterprise';
});

test('first request creates state with count=1', async () => {
  const s = new MemoryQuotaStorage();
  const r = await checkAndConsumeQuota(s, 'tenant-a', 'free');
  return r.allowed && r.used === 1 && r.remaining === MONTHLY_QUOTAS.free - 1;
});

test('quota increments per request', async () => {
  const s = new MemoryQuotaStorage();
  for (let i = 0; i < 3; i += 1) {
    await checkAndConsumeQuota(s, 'tenant-b', 'free');
  }
  const last = await checkAndConsumeQuota(s, 'tenant-b', 'free');
  return last.allowed && last.used === 4;
});

test('quota denies when limit reached', async () => {
  const s = new MemoryQuotaStorage();
  // Pre-seed state at exactly the cap so the next call should be denied.
  await s.set(`quota:tenant-c:${monthKey()}`, {
    count: MONTHLY_QUOTAS.free,
    lastUpdated: Date.now(),
  }, 0);
  const r = await checkAndConsumeQuota(s, 'tenant-c', 'free');
  return !r.allowed && r.remaining === 0 && r.used === MONTHLY_QUOTAS.free;
});

test('different tiers see different caps', async () => {
  const s = new MemoryQuotaStorage();
  const free = await checkAndConsumeQuota(s, 'tenant-d', 'free');
  const ent = await checkAndConsumeQuota(s, 'tenant-e', 'enterprise');
  return free.limit === 5_000 && ent.limit === 1_000_000;
});

test('quota windows isolate by tenant', async () => {
  const s = new MemoryQuotaStorage();
  await checkAndConsumeQuota(s, 'tenant-f', 'free');
  await checkAndConsumeQuota(s, 'tenant-g', 'free');
  const f = await s.get(`quota:tenant-f:${monthKey()}`);
  const g = await s.get(`quota:tenant-g:${monthKey()}`);
  return f?.count === 1 && g?.count === 1;
});

async function runTests() {
  console.log('Running monthly-quota tests...\n');
  for (const t of tests) {
    try {
      const ok = await t.run();
      if (ok) {
        console.log(`✅ ${t.name}`);
        passed += 1;
      } else {
        console.log(`❌ ${t.name}`);
        failed += 1;
      }
    } catch (err) {
      console.log(`❌ ${t.name} → ${err}`);
      failed += 1;
    }
  }
  console.log(`\n${passed}/${passed + failed} passed`);
  if (failed > 0) process.exit(1);
}

runTests();
