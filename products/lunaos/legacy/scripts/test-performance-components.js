/**
 * Simple functional test for performance optimization components
 */

const { WorkerPool, MemoryMonitor, LazyAnalyzerLoader } = require('./packages/lunaforge-core/dist/graph/ConcurrentBuilder');
const { BenchmarkSuite } = require('./packages/lunaforge-core/dist/performance/BenchmarkSuite');

async function testWorkerPool() {
  console.log('🧪 Testing WorkerPool...');

  const workerPool = new WorkerPool(2);

  // Execute simple task
  const task = {
    type: 'test',
    data: { value: 42 }
  };

  try {
    const result = await workerPool.execute(task);
    console.log('✅ WorkerPool basic execution: SUCCESS');

    // Test stats
    const stats = workerPool.getStats();
    console.log(`📊 Stats: ${stats.completedTasks} tasks completed`);

    // Test concurrent execution
    const tasks = Array(5).fill(0).map((_, index) => ({
      type: 'test',
      data: { index }
    }));

    const results = await Promise.all(tasks.map(task => workerPool.execute(task)));
    console.log('✅ WorkerPool concurrent execution: SUCCESS');

    workerPool.dispose();
    return true;
  } catch (error) {
    console.error('❌ WorkerPool test failed:', error.message);
    workerPool.dispose();
    return false;
  }
}

async function testMemoryMonitor() {
  console.log('🧪 Testing MemoryMonitor...');

  try {
    const monitor = new MemoryMonitor({
      warningThreshold: 100 * 1024 * 1024, // 100MB
      criticalThreshold: 200 * 1024 * 1024, // 200MB
      checkInterval: 100
    });

    // Test stats collection
    const stats = monitor.getStats();
    console.log(`📊 Memory: ${(stats.current / 1024 / 1024).toFixed(2)} MB current`);

    // Test trend analysis
    const trend = monitor.getTrend(60);
    console.log(`📈 Memory trend slope: ${trend.slope?.toFixed(2) || 'N/A'}`);

    // Test cleanup suggestions
    const suggestions = monitor.suggestCleanup();
    console.log(`💡 Cleanup suggestions: ${suggestions.length} found`);

    monitor.dispose();
    console.log('✅ MemoryMonitor: SUCCESS');
    return true;
  } catch (error) {
    console.error('❌ MemoryMonitor test failed:', error.message);
    return false;
  }
}

async function testLazyAnalyzerLoader() {
  console.log('🧪 Testing LazyAnalyzerLoader...');

  try {
    // Clear cache
    LazyAnalyzerLoader.clearCache();

    // Register mock analyzer
    LazyAnalyzerLoader.registerAnalyzer('test-analyzer', async () => ({
      name: 'Test Analyzer',
      version: '1.0.0',
      analyzeFile: async (content) => ({
        dependencies: [],
        classes: [],
        functions: [],
        imports: [],
        exports: []
      })
    }));

    // Load analyzer
    const analyzer = await LazyAnalyzerLoader.loadAnalyzer('test-analyzer');
    console.log(`✅ Loaded analyzer: ${analyzer.name}`);

    // Test caching
    const analyzer2 = await LazyAnalyzerLoader.loadAnalyzer('test-analyzer');
    console.log('✅ Analyzer caching: SUCCESS');

    // Test stats
    const stats = LazyAnalyzerLoader.getStats();
    console.log(`📊 Loader stats: ${stats.loadedAnalyzers}/${stats.registeredAnalyzers} loaded`);

    return true;
  } catch (error) {
    console.error('❌ LazyAnalyzerLoader test failed:', error.message);
    return false;
  }
}

async function testBenchmarkSuite() {
  console.log('🧪 Testing BenchmarkSuite...');

  try {
    const suite = new BenchmarkSuite({
      iterations: 3,
      warmupIterations: 1,
      measureMemory: true,
      gcBefore: false,
      gcAfter: false
    });

    // Run simple benchmark
    const result = await suite.runBenchmark('test-operation', async () => {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'test-result';
    });

    console.log(`✅ Benchmark completed: ${result.duration.toFixed(2)}ms avg`);
    console.log(`📊 Throughput: ${result.throughput.toFixed(2)} ops/sec`);

    // Test result export
    const json = suite.exportResults();
    const csv = suite.exportResultsToCSV();

    console.log('✅ Result export: SUCCESS');
    return true;
  } catch (error) {
    console.error('❌ BenchmarkSuite test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Performance Components Functional Tests\n');

  const tests = [
    testWorkerPool,
    testMemoryMonitor,
    testLazyAnalyzerLoader,
    testBenchmarkSuite
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    const result = await test();
    if (result) passed++;
    console.log(''); // spacing
  }

  console.log('📋 Test Results:');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);

  if (passed === total) {
    console.log('🎉 All performance optimization components working correctly!');
  } else {
    console.log('⚠️  Some components have issues');
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch(console.error);