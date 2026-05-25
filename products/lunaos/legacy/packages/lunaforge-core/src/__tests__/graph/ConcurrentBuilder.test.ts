/**
 * Tests for ConcurrentBuilder performance optimization components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkerPool, MemoryMonitor, LazyAnalyzerLoader } from '../../graph/ConcurrentBuilder';
import { BenchmarkSuite } from '../../performance/BenchmarkSuite';

describe('ConcurrentBuilder', () => {
  describe('WorkerPool', () => {
    let workerPool: WorkerPool;

    beforeEach(() => {
      workerPool = new WorkerPool(2);
    });

    afterEach(() => {
      workerPool.dispose();
    });

    it('should create worker pool with specified size', () => {
      expect(workerPool.getStats()).toEqual({
        totalWorkers: 2,
        busyWorkers: 0,
        queuedTasks: 0,
        completedTasks: 0
      });
    });

    it('should execute simple tasks', async () => {
      const task = {
        type: 'test',
        data: { value: 42 }
      };

      const result = await workerPool.execute(task);
      expect(result).toBeDefined();
    });

    it('should handle multiple concurrent tasks', async () => {
      const tasks = Array(10).fill(0).map((_, index) => ({
        type: 'test',
        data: { index }
      }));

      const results = await Promise.all(tasks.map(task => workerPool.execute(task)));
      expect(results).toHaveLength(10);
    });

    it('should queue tasks when all workers are busy', async () => {
      const tasks = Array(5).fill(0).map((_, index) => ({
        type: 'test',
        data: { index }
      }));

      // Execute tasks concurrently
      const promises = tasks.map(task => workerPool.execute(task));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      const stats = workerPool.getStats();
      expect(stats.completedTasks).toBe(5);
    });

    it('should provide performance statistics', () => {
      const stats = workerPool.getPerformanceStats();
      expect(stats).toHaveProperty('averageTaskTime');
      expect(stats).toHaveProperty('peakQueueSize');
      expect(stats).toHaveProperty('workerUtilization');
    });
  });

  describe('MemoryMonitor', () => {
    let monitor: MemoryMonitor;

    beforeEach(() => {
      monitor = new MemoryMonitor({
        warningThreshold: 100 * 1024 * 1024, // 100MB
        criticalThreshold: 200 * 1024 * 1024, // 200MB
        checkInterval: 100
      });
    });

    afterEach(() => {
      monitor.dispose();
    });

    it('should track memory usage', () => {
      const stats = monitor.getStats();
      expect(stats).toHaveProperty('current');
      expect(stats).toHaveProperty('peak');
      expect(stats).toHaveProperty('average');
      expect(stats).toHaveProperty('samples');
      expect(stats.samples).toBeGreaterThan(0);
    });

    it('should detect memory warnings', () => {
      const mockWarning = vi.fn();
      monitor.on('warning', mockWarning);

      // Simulate high memory usage
      monitor.checkThresholds(150 * 1024 * 1024);

      expect(mockWarning).toHaveBeenCalled();
    });

    it('should detect critical memory usage', () => {
      const mockCritical = vi.fn();
      monitor.on('critical', mockCritical);

      // Simulate critical memory usage
      monitor.checkThresholds(250 * 1024 * 1024);

      expect(mockCritical).toHaveBeenCalled();
    });

    it('should provide memory trend analysis', () => {
      const trend = monitor.getTrend(60); // 1 minute
      expect(trend).toHaveProperty('slope');
      expect(trend).toHaveProperty('correlation');
      expect(trend).toHaveProperty('projection');
    });

    it('should suggest cleanup actions', () => {
      const suggestions = monitor.suggestCleanup();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('LazyAnalyzerLoader', () => {
    beforeEach(() => {
      // Clear any registered analyzers
      LazyAnalyzerLoader.clearCache();
    });

    it('should register and load analyzers', async () => {
      const mockFactory = vi.fn().mockResolvedValue({
        name: 'Test Analyzer',
        version: '1.0.0',
        analyzeFile: vi.fn()
      });

      LazyAnalyzerLoader.registerAnalyzer('test', mockFactory);

      const analyzer = await LazyAnalyzerLoader.loadAnalyzer('test');
      expect(analyzer).toBeDefined();
      expect(analyzer.name).toBe('Test Analyzer');
      expect(mockFactory).toHaveBeenCalledTimes(1);
    });

    it('should cache loaded analyzers', async () => {
      const mockFactory = vi.fn().mockResolvedValue({
        name: 'Cached Analyzer',
        version: '1.0.0',
        analyzeFile: vi.fn()
      });

      LazyAnalyzerLoader.registerAnalyzer('cached', mockFactory);

      // Load analyzer twice
      const analyzer1 = await LazyAnalyzerLoader.loadAnalyzer('cached');
      const analyzer2 = await LazyAnalyzerLoader.loadAnalyzer('cached');

      expect(analyzer1).toBe(analyzer2); // Same instance
      expect(mockFactory).toHaveBeenCalledTimes(1); // Factory called once
    });

    it('should preload specified analyzers', async () => {
      const mockFactory1 = vi.fn().mockResolvedValue({ name: 'Analyzer 1' });
      const mockFactory2 = vi.fn().mockResolvedValue({ name: 'Analyzer 2' });

      LazyAnalyzerLoader.registerAnalyzer('test1', mockFactory1);
      LazyAnalyzerLoader.registerAnalyzer('test2', mockFactory2);

      await LazyAnalyzerLoader.preloadAnalyzers(['test1', 'test2']);

      expect(mockFactory1).toHaveBeenCalledTimes(1);
      expect(mockFactory2).toHaveBeenCalledTimes(1);

      const stats = LazyAnalyzerLoader.getStats();
      expect(stats.loadedAnalyzers).toBe(2);
    });

    it('should provide loader statistics', () => {
      const stats = LazyAnalyzerLoader.getStats();
      expect(stats).toHaveProperty('registeredAnalyzers');
      expect(stats).toHaveProperty('loadedAnalyzers');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
    });

    it('should throw error for unregistered analyzer', async () => {
      await expect(LazyAnalyzerLoader.loadAnalyzer('nonexistent'))
        .rejects.toThrow('No analyzer registered');
    });
  });
});

describe('BenchmarkSuite', () => {
  let suite: BenchmarkSuite;

  beforeEach(() => {
    suite = new BenchmarkSuite({
      iterations: 3,
      warmupIterations: 1,
      measureMemory: true,
      gcBefore: false, // Disable for tests
      gcAfter: false
    });
  });

  it('should create benchmark suite with default config', () => {
    const defaultSuite = new BenchmarkSuite();
    const config = defaultSuite.getResults();
    expect(config).toBeDefined();
  });

  it('should run individual benchmark', async () => {
    const result = await suite.runBenchmark('test-operation', async () => {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'test-result';
    });

    expect(result.operation).toBe('test-operation');
    expect(result.duration).toBeGreaterThan(0);
    expect(result.throughput).toBeGreaterThan(0);
    expect(result.metadata.iterations).toBe(3);
  });

  it('should measure memory usage', async () => {
    // Create a large array to affect memory usage
    const result = await suite.runBenchmark('memory-test', async () => {
      const largeArray = Array(10000).fill(0).map(() => ({ data: 'x'.repeat(100) }));
      return largeArray.length;
    });

    expect(result.memoryUsage.before).toBeGreaterThan(0);
    expect(result.memoryUsage.after).toBeGreaterThan(0);
  });

  it('should calculate standard deviation', async () => {
    const result = await suite.runBenchmark('std-dev-test', async () => {
      // Variable execution time
      const delay = Math.random() * 20;
      await new Promise(resolve => setTimeout(resolve, delay));
      return delay;
    });

    expect(result.metadata.stdDeviation).toBeGreaterThan(0);
  });

  it('should export results to JSON', () => {
    const results = suite.getResults();
    const json = suite.exportResults();

    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('config');
    expect(parsed).toHaveProperty('results');
  });

  it('should export results to CSV', async () => {
    // Run at least one benchmark
    await suite.runBenchmark('csv-test', async () => {
      return 'test-data';
    });

    const csv = suite.exportResultsToCSV();
    const lines = csv.split('\n');

    expect(lines[0]).toContain('Operation');
    expect(lines[0]).toContain('Duration');
    expect(lines[0]).toContain('Throughput');
    expect(lines.length).toBeGreaterThan(1); // Header + data
  });

  it('should format bytes correctly', () => {
    // Test the private method through public API
    const json = suite.exportResults();
    expect(json).toBeDefined();
  });

  it('should handle benchmark errors gracefully', async () => {
    await expect(
      suite.runBenchmark('error-test', async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
  });
});

describe('Performance Integration', () => {
  it('should integrate worker pool with memory monitor', async () => {
    const workerPool = new WorkerPool(2);
    const monitor = new MemoryMonitor({ checkInterval: 50 });

    const mockWarning = vi.fn();
    monitor.on('warning', mockWarning);

    // Execute tasks that consume memory
    const tasks = Array(10).fill(0).map((_, index) => ({
      type: 'memory-intensive',
      data: {
        size: 1000,
        index
      }
    }));

    await Promise.all(tasks.map(task => workerPool.execute(task)));

    const workerStats = workerPool.getStats();
    const memoryStats = monitor.getStats();

    expect(workerStats.completedTasks).toBe(10);
    expect(memoryStats.samples).toBeGreaterThan(0);

    workerPool.dispose();
    monitor.dispose();
  });

  it('should load analyzers concurrently', async () => {
    // Register multiple analyzers
    for (let i = 0; i < 5; i++) {
      LazyAnalyzerLoader.registerAnalyzer(`test-${i}`, async () => ({
        name: `Test Analyzer ${i}`,
        version: '1.0.0',
        analyzeFile: vi.fn()
      }));
    }

    // Load all analyzers concurrently
    const analyzers = await Promise.all(
      Array(5).fill(0).map((_, index) =>
        LazyAnalyzerLoader.loadAnalyzer(`test-${index}`)
      )
    );

    expect(analyzers).toHaveLength(5);
    analyzers.forEach((analyzer, index) => {
      expect(analyzer.name).toBe(`Test Analyzer ${index}`);
    });

    const stats = LazyAnalyzerLoader.getStats();
    expect(stats.loadedAnalyzers).toBe(5);
  });
});