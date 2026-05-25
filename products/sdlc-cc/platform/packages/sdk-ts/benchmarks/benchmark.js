// Performance benchmarks for the SDK

const { performance } = require('perf_hooks');
const { createClient } = require('../dist/cjs');

// Mock fetch for Node.js
global.fetch = async (url, options) => {
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    headers: new Map()
  };
};

async function benchmark(name, fn, iterations = 1000) {
  console.log(`\n📊 Benchmark: ${name}`);
  console.log(`Iterations: ${iterations}`);

  // Warm up
  for (let i = 0; i < 100; i++) {
    await fn();
  }

  // Run benchmark
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = performance.now();

  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  const opsPerSec = 1000 / avgTime;

  console.log(`Total time: ${totalTime.toFixed(2)}ms`);
  console.log(`Average time: ${avgTime.toFixed(4)}ms`);
  console.log(`Operations/sec: ${opsPerSec.toFixed(0)}`);

  return { totalTime, avgTime, opsPerSec };
}

async function runBenchmarks() {
  console.log('🚀 Starting SDLC.ai JavaScript SDK Benchmarks');

  // Test 1: Client instantiation
  await benchmark('Client instantiation', () => {
    const client = createClient({
      baseURL: 'https://api.sdlc.cc',
      apiKey: 'test-key'
    });
  });

  // Test 2: Config update
  const client = createClient({
    baseURL: 'https://api.sdlc.cc',
    apiKey: 'test-key'
  });

  await benchmark('Config update', () => {
    client.updateConfig({ timeout: 5000 });
  });

  // Test 3: Health check
  await benchmark('Health check', () => {
    return client.healthCheck();
  }, 100);

  // Test 4: Token parsing
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  await benchmark('Token parsing', () => {
    client.auth.getTokenPayload(token);
  }, 10000);

  // Test 5: Encryption/Decryption
  await benchmark('Encryption', () => {
    const encrypted = client.auth['SecurityUtils'].encrypt('test data');
    return encrypted;
  }, 1000);

  await benchmark('Decryption', () => {
    const encrypted = client.auth['SecurityUtils'].encrypt('test data');
    const decrypted = client.auth['SecurityUtils'].decrypt(encrypted);
    return decrypted;
  }, 1000);

  // Test 6: Request creation
  await benchmark('Request creation', () => {
    return client['request']({
      url: '/test',
      method: 'GET'
    });
  }, 1000);

  console.log('\n✅ Benchmarks complete!');
}

runBenchmarks().catch(console.error);
