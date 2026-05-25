/**
 * CLI Performance Optimizations
 * Lazy loading, caching, and startup optimizations
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

export interface PerformanceMetrics {
  startupTime: number;
  commandExecutionTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  pluginLoadTime: number;
  configLoadTime: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export class PerformanceOptimizer {
  private cache = new Map<string, CacheEntry<any>>();
  private metrics: Partial<PerformanceMetrics> = {};
  private startTime: number = Date.now();

  // Cache TTL in milliseconds (default: 5 minutes)
  private readonly DEFAULT_TTL = 5 * 60 * 1000;

  constructor() {
    this.setupPerformanceMonitoring();
  }

  /**
   * Setup performance monitoring and optimization
   */
  private setupPerformanceMonitoring(): void {
    // Monitor memory usage
    if (process.env.NODE_ENV !== 'production') {
      setInterval(() => {
        this.metrics.memoryUsage = process.memoryUsage();
      }, 5000);
    }
  }

  /**
   * Get or set cached data with TTL
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count and return data
    entry.hits++;
    return entry.data;
  }

  /**
   * Set cached data with custom TTL
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0
    });
  }

  /**
   * Clear cache by pattern or all cache
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ key: string; hits: number; age: number }> } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      age: Date.now() - entry.timestamp
    }));

    return {
      size: this.cache.size,
      entries
    };
  }

  /**
   * Lazy load module with caching
   */
  async lazyLoad<T>(modulePath: string): Promise<T> {
    const cacheKey = `module:${modulePath}`;

    // Try to get from cache first
    const cached = this.get<T>(cacheKey);
    if (cached) {
      return cached;
    }

    // Load module asynchronously
    const startTime = Date.now();

    try {
      // Clear require cache to ensure fresh load
      delete require.cache[require.resolve(modulePath)];

      const module = require(modulePath);
      this.set(cacheKey, module);

      this.metrics.pluginLoadTime = Date.now() - startTime;
      return module;
    } catch (error) {
      throw new Error(`Failed to load module "${modulePath}": ${error.message}`);
    }
  }

  /**
   * Batch load multiple modules
   */
  async batchLoad<T>(modulePaths: string[]): Promise<T[]> {
    const promises = modulePaths.map(path => this.lazyLoad<T>(path));
    return Promise.all(promises);
  }

  /**
   * Debounce function execution
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle function execution
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Memoize function results
   */
  memoize<T extends (...args: any[]) => any>(
    func: T,
    getKey?: (...args: Parameters<T>) => string
  ): T {
    const cache = new Map<string, ReturnType<T>>();

    return ((...args: Parameters<T>) => {
      const key = getKey ? getKey(...args) : JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }

  /**
   * Optimize file system operations
   */
  async optimizedFileRead(filePath: string): Promise<string> {
    const cacheKey = `file:${filePath}:${this.getFileHash(filePath)}`;

    // Try cache first
    const cached = this.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    // Read file with optimized settings
    const startTime = Date.now();

    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      this.set(cacheKey, data);

      this.metrics.configLoadTime = Date.now() - startTime;
      return data;
    } catch (error) {
      throw new Error(`Failed to read file "${filePath}": ${error.message}`);
    }
  }

  /**
   * Get file hash for cache invalidation
   */
  private getFileHash(filePath: string): string {
    try {
      const stats = fs.statSync(filePath);
      return `${stats.mtime.getTime()}-${stats.size}`;
    } catch {
      return Date.now().toString();
    }
  }

  /**
   * Preload essential modules
   */
  async preloadEssentials(): Promise<void> {
    const essentialModules = [
      'commander',
      'chalk',
      'inquirer',
      'ora'
    ];

    try {
      await this.batchLoad(essentialModules);
      console.debug('✅ Essential modules preloaded');
    } catch (error) {
      console.warn('⚠️  Failed to preload modules:', error.message);
    }
  }

  /**
   * Start performance timer
   */
  startTimer(operation: string): () => number {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.metrics[operation as keyof PerformanceMetrics] = duration;
      return duration;
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      startupTime: this.metrics.startupTime || Date.now() - this.startTime,
      commandExecutionTime: this.metrics.commandExecutionTime || 0,
      memoryUsage: this.metrics.memoryUsage || process.memoryUsage(),
      pluginLoadTime: this.metrics.pluginLoadTime || 0,
      configLoadTime: this.metrics.configLoadTime || 0
    };
  }

  /**
   * Print performance report
   */
  printReport(): void {
    const metrics = this.getMetrics();
    const cacheStats = this.getCacheStats();

    console.log('\n📊 Performance Report');
    console.log('===================');
    console.log(`⏱️  Startup time: ${metrics.startupTime}ms`);
    console.log(`⚡ Command execution: ${metrics.commandExecutionTime}ms`);
    console.log(`🔌 Plugin loading: ${metrics.pluginLoadTime}ms`);
    console.log(`⚙️  Config loading: ${metrics.configLoadTime}ms`);
    console.log(`💾 Memory usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`🗄️  Cache entries: ${cacheStats.size}`);

    if (cacheStats.entries.length > 0) {
      console.log('\nCache Details:');
      cacheStats.entries
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 5)
        .forEach(entry => {
          console.log(`  ${entry.key}: ${entry.hits} hits (${entry.age}ms old)`);
        });
    }
  }

  /**
   * Optimize CLI startup
   */
  optimizeStartup(): void {
    // Set process optimizations
    if (process.env.NODE_ENV === 'production') {
      process.env.NODE_OPTIONS = '--max-old-space-size=512';
    }

    // Enable garbage collection hints
    if (global.gc) {
      setTimeout(() => global.gc(), 1000);
    }

    // Optimize event loop
    process.nextTick(() => {
      // Preload frequently used modules
      this.preloadEssentials();
    });
  }

  /**
   * Memory cleanup
   */
  cleanup(): void {
    // Clear old cache entries
    for (const [key, entry] of this.cache) {
      if (Date.now() - entry.timestamp > entry.ttl * 2) {
        this.cache.delete(key);
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Benchmark function performance
   */
  async benchmark<T>(
    name: string,
    func: () => T | Promise<T>,
    iterations: number = 100
  ): Promise<{ name: string; totalTime: number; averageTime: number; opsPerSecond: number }> {
    const results: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await func();
      results.push(Date.now() - start);
    }

    const totalTime = results.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const opsPerSecond = 1000 / averageTime;

    return {
      name,
      totalTime,
      averageTime,
      opsPerSecond
    };
  }

  /**
   * Run performance benchmarks
   */
  async runBenchmarks(): Promise<void> {
    console.log('🏃 Running performance benchmarks...');

    const benchmarks = await Promise.all([
      this.benchmark('Cache Get/Set', () => {
        const key = 'test-key';
        const value = { data: 'test-data' };
        this.set(key, value);
        return this.get(key);
      }),
      this.benchmark('File Read', () => {
        return this.optimizedFileRead('./package.json');
      }),
      this.benchmark('Memory Usage', () => {
        return process.memoryUsage();
      })
    ]);

    console.log('\n📈 Benchmark Results:');
    console.log('====================');

    benchmarks.forEach(benchmark => {
      console.log(`${benchmark.name}:`);
      console.log(`  Average: ${benchmark.averageTime.toFixed(2)}ms`);
      console.log(`  Ops/sec: ${benchmark.opsPerSecond.toFixed(0)}`);
      console.log('');
    });
  }
}

export default PerformanceOptimizer;