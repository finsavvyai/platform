/**
 * Rate Limiter Tests
 *
 * Comprehensive test suite for token bucket rate limiting
 * Week 2 Day 2
 */

import {
  TokenBucketRateLimiter,
  RateLimitConfig,
  RateLimitState,
  RateLimitStorage,
  RATE_LIMIT_PLANS,
  PlanType,
  checkRateLimit,
  getRateLimitKey,
  getPlanType,
} from './rate-limiter';

/**
 * In-memory storage for testing
 */
class MemoryRateLimitStorage implements RateLimitStorage {
  private store = new Map<string, RateLimitState>();

  async get(key: string): Promise<RateLimitState | null> {
    return this.store.get(`ratelimit:${key}`) || null;
  }

  async set(key: string, state: RateLimitState): Promise<void> {
    this.store.set(`ratelimit:${key}`, state);
  }

  clear() {
    this.store.clear();
  }
}

// Test cases
interface TestCase {
  name: string;
  run: () => Promise<boolean>;
}

const tests: TestCase[] = [];
let passed = 0;
let failed = 0;

// Helper to add test
function test(name: string, fn: () => Promise<boolean>) {
  tests.push({ name, run: fn });
}

// Test: Token bucket initialization
test('Initialize token bucket with full capacity', async () => {
  const config: RateLimitConfig = {
    tokensPerMinute: 10,
    bucketSize: 20,
    burstSize: 5,
    costPerRequest: 1,
  };

  const state = TokenBucketRateLimiter.resetState(config);
  return state.tokens === 20 && state.requestCount === 0;
});

// Test: Single request allowed
test('Allow single request with available tokens', async () => {
  const config = RATE_LIMIT_PLANS[PlanType.FREE];
  const limiter = new TokenBucketRateLimiter(config);
  const state = TokenBucketRateLimiter.resetState(config);

  const result = limiter.checkLimit(state);
  return result.allowed === true && result.remaining === config.bucketSize - 1;
});

// Test: Request denied when no tokens
test('Deny request when bucket is empty', async () => {
  const config = RATE_LIMIT_PLANS[PlanType.FREE];
  const limiter = new TokenBucketRateLimiter(config);
  const state: RateLimitState = {
    tokens: 0,
    lastRefill: Date.now(),
    requestCount: 0,
    lastReset: Date.now(),
  };

  const result = limiter.checkLimit(state);
  return result.allowed === false && result.retryAfter !== undefined;
});

// Test: Token refill over time
test('Refill tokens based on elapsed time', async () => {
  const config: RateLimitConfig = {
    tokensPerMinute: 60,  // 1 token per second
    bucketSize: 100,
    burstSize: 10,
    costPerRequest: 1,
  };

  const limiter = new TokenBucketRateLimiter(config);
  const now = Date.now();
  const state: RateLimitState = {
    tokens: 0,
    lastRefill: now - 5000,  // 5 seconds ago
    requestCount: 0,
    lastReset: now,
  };

  const result = limiter.checkLimit(state, now);
  // Should have ~5 tokens (5 seconds * 1 token/second)
  return result.remaining >= 4 && result.remaining <= 6;
});

// Test: Bucket doesn't overflow
test('Bucket capacity limits token accumulation', async () => {
  const config: RateLimitConfig = {
    tokensPerMinute: 60,
    bucketSize: 10,  // Small bucket
    burstSize: 5,
    costPerRequest: 1,
  };

  const limiter = new TokenBucketRateLimiter(config);
  const now = Date.now();
  const state: RateLimitState = {
    tokens: 5,
    lastRefill: now - 60000,  // 1 minute ago (would add 60 tokens)
    requestCount: 0,
    lastReset: now,
  };

  const result = limiter.checkLimit(state, now);
  // Should cap at bucket size (10), minus cost (1) = 9
  return result.remaining === 9;
});

// Test: Burst handling
test('Allow burst of requests up to bucket size', async () => {
  const config = RATE_LIMIT_PLANS[PlanType.FREE];
  const limiter = new TokenBucketRateLimiter(config);
  let state = TokenBucketRateLimiter.resetState(config);

  // Make burst of 20 requests (bucket size)
  let allAllowed = true;
  for (let i = 0; i < 20; i++) {
    const result = limiter.checkLimit(state);
    if (!result.allowed) {
      allAllowed = false;
      break;
    }
    state.tokens = result.remaining;
  }

  // 21st request should be denied
  const finalResult = limiter.checkLimit(state);

  return allAllowed && !finalResult.allowed;
});

// Test: Rate limit plans
test('FREE plan has correct limits', async () => {
  const config = RATE_LIMIT_PLANS[PlanType.FREE];
  return config.tokensPerMinute === 10 && config.bucketSize === 20;
});

test('STARTUP plan has higher limits', async () => {
  const config = RATE_LIMIT_PLANS[PlanType.STARTUP];
  return config.tokensPerMinute === 100 && config.bucketSize === 200;
});

test('ENTERPRISE plan has highest limits', async () => {
  const config = RATE_LIMIT_PLANS[PlanType.ENTERPRISE];
  return config.tokensPerMinute === 1000 && config.bucketSize === 2000;
});

// Test: Storage operations
test('Store and retrieve rate limit state', async () => {
  const storage = new MemoryRateLimitStorage();
  const state: RateLimitState = {
    tokens: 15,
    lastRefill: Date.now(),
    requestCount: 5,
    lastReset: Date.now(),
  };

  await storage.set('test-key', state);
  const retrieved = await storage.get('test-key');

  return retrieved !== null && retrieved.tokens === 15 && retrieved.requestCount === 5;
});

// Test: High-level checkRateLimit function
test('checkRateLimit integration', async () => {
  const storage = new MemoryRateLimitStorage();
  const userId = 'user_123';
  const apiKeyId = 'key_456';

  // First request should be allowed
  const result1 = await checkRateLimit(storage, userId, apiKeyId, PlanType.FREE);

  // Check state was persisted
  const key = getRateLimitKey(userId, apiKeyId);
  const state = await storage.get(key);

  return result1.allowed && state !== null && state.requestCount === 1;
});

// Test: Rate limit key generation
test('Generate consistent rate limit keys', async () => {
  const key1 = getRateLimitKey('user_123', 'key_456');
  const key2 = getRateLimitKey('user_123', 'key_456');
  const key3 = getRateLimitKey('user_456', 'key_123');

  return key1 === key2 && key1 !== key3;
});

// Test: Plan type detection
test('Detect FREE plan from user data', async () => {
  const userData = { plan: 'free' };
  const planType = getPlanType(userData);
  return planType === PlanType.FREE;
});

test('Detect STARTUP plan from user data', async () => {
  const userData = { plan: 'STARTUP' };  // Case insensitive
  const planType = getPlanType(userData);
  return planType === PlanType.STARTUP;
});

test('Default to FREE plan for unknown plans', async () => {
  const userData = { plan: 'unknown' };
  const planType = getPlanType(userData);
  return planType === PlanType.FREE;
});

// Test: Concurrent requests
test('Handle multiple concurrent requests correctly', async () => {
  const storage = new MemoryRateLimitStorage();
  const userId = 'user_concurrent';
  const apiKeyId = 'key_concurrent';

  // Simulate 5 concurrent requests
  const promises = Array.from({ length: 5 }, () =>
    checkRateLimit(storage, userId, apiKeyId, PlanType.FREE)
  );

  const results = await Promise.all(promises);
  const allowedCount = results.filter(r => r.allowed).length;

  // All 5 should be allowed (FREE plan has 20 token bucket)
  return allowedCount === 5;
});

// Test: Reset after time passes
test('Allow requests after waiting for token refill', async () => {
  const config: RateLimitConfig = {
    tokensPerMinute: 60,  // 1 token per second
    bucketSize: 2,
    burstSize: 2,
    costPerRequest: 1,
  };

  const limiter = new TokenBucketRateLimiter(config);
  const now = Date.now();
  let state = TokenBucketRateLimiter.resetState(config);

  // Use all tokens
  limiter.checkLimit(state, now);
  const result1 = limiter.checkLimit({ ...state, tokens: 0 }, now);

  // Should be denied
  if (result1.allowed) return false;

  // Wait 2 seconds (should add 2 tokens)
  const result2 = limiter.checkLimit({ ...state, tokens: 0 }, now + 2000);

  // Should be allowed now
  return result2.allowed && result2.remaining >= 1;
});

// Run all tests
async function runTests() {
  console.log('🧪 Running Rate Limiter Tests...\n');

  for (const testCase of tests) {
    try {
      const success = await testCase.run();
      if (success) {
        console.log(`✅ PASS: ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${testCase.name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testCase.name}`);
      console.log(`   ${error}`);
      failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Summary:`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Total: ${passed + failed}`);
  console.log(`   Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed`);
    process.exit(1);
  }
}

runTests();
