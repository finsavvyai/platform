/**
 * Test Shard Manager
 * Splits test suites across workers for parallel execution
 */

import { logger } from '../../lib/logger.js';
import {
  ExecutionShard,
  ShardResult,
  ShardStrategy,
  ShardMetrics,
} from './types.js';

interface TestMetadata {
  path: string;
  estimatedDuration: number;
  tags?: string[];
}

export class TestShardManager {
  private testMetadata: Map<string, TestMetadata> = new Map();

  constructor() {
  }

  /**
   * Register test metadata for smarter sharding
   */
  registerTestMetadata(path: string, estimatedDuration: number, tags?: string[]): void {
    this.testMetadata.set(path, { path, estimatedDuration, tags });
  }

  /**
   * Shard tests across workers using specified strategy
   */
  shardTests(
    tests: string[],
    workerCount: number,
    strategy: ShardStrategy = 'round-robin'
  ): ExecutionShard[] {
    if (workerCount <= 0) {
      throw new Error('workerCount must be > 0');
    }

    if (tests.length === 0) {
      return [];
    }

    const shards: ExecutionShard[] = [];

    switch (strategy) {
      case 'round-robin':
        return this.shardRoundRobin(tests, workerCount);
      case 'by-duration':
        return this.shardByDuration(tests, workerCount);
      case 'by-file':
        return this.shardByFile(tests, workerCount);
      case 'by-tag':
        return this.shardByTag(tests, workerCount);
      default:
        throw new Error(`Unknown shard strategy: ${strategy}`);
    }
  }

  /**
   * Round-robin sharding: distribute tests evenly
   */
  private shardRoundRobin(tests: string[], workerCount: number): ExecutionShard[] {
    const shards: ExecutionShard[] = [];

    for (let i = 0; i < workerCount; i++) {
      shards.push({
        id: `shard-${Date.now()}-${i}`,
        workerId: '',
        tests: [],
        estimatedDuration: 0,
        retryCount: 0,
      });
    }

    for (let i = 0; i < tests.length; i++) {
      const shardIdx = i % workerCount;
      shards[shardIdx].tests.push(tests[i]);

      const duration = this.testMetadata.get(tests[i])?.estimatedDuration ?? 5000;
      shards[shardIdx].estimatedDuration += duration;
    }

    logger.info(`Sharded ${tests.length} tests across ${workerCount} workers (round-robin)`);
    return shards;
  }

  /**
   * Duration-based sharding: balance execution time
   */
  private shardByDuration(tests: string[], workerCount: number): ExecutionShard[] {
    const shards: ExecutionShard[] = [];

    for (let i = 0; i < workerCount; i++) {
      shards.push({
        id: `shard-${Date.now()}-${i}`,
        workerId: '',
        tests: [],
        estimatedDuration: 0,
        retryCount: 0,
      });
    }

    // Sort tests by duration descending for better load balancing
    const sortedTests = [...tests].sort((a, b) => {
      const durationA = this.testMetadata.get(a)?.estimatedDuration ?? 5000;
      const durationB = this.testMetadata.get(b)?.estimatedDuration ?? 5000;
      return durationB - durationA;
    });

    // Greedy assignment: add test to shard with least total duration
    for (const test of sortedTests) {
      const duration = this.testMetadata.get(test)?.estimatedDuration ?? 5000;
      const minShard = shards.reduce((min, shard) =>
        shard.estimatedDuration < min.estimatedDuration ? shard : min
      );

      minShard.tests.push(test);
      minShard.estimatedDuration += duration;
    }

    logger.info(
      `Sharded ${tests.length} tests across ${workerCount} workers (balanced duration)`
    );
    return shards;
  }

  /**
   * File-based sharding: group tests by source file
   */
  private shardByFile(tests: string[], workerCount: number): ExecutionShard[] {
    const shards: ExecutionShard[] = [];

    for (let i = 0; i < workerCount; i++) {
      shards.push({
        id: `shard-${Date.now()}-${i}`,
        workerId: '',
        tests: [],
        estimatedDuration: 0,
        retryCount: 0,
      });
    }

    // Group tests by file path prefix
    const fileGroups = new Map<string, string[]>();
    for (const test of tests) {
      const file = this.extractFilePath(test);
      if (!fileGroups.has(file)) {
        fileGroups.set(file, []);
      }
      fileGroups.get(file)!.push(test);
    }

    // Distribute file groups round-robin
    let shardIdx = 0;
    for (const testGroup of fileGroups.values()) {
      for (const test of testGroup) {
        const duration = this.testMetadata.get(test)?.estimatedDuration ?? 5000;
        shards[shardIdx].tests.push(test);
        shards[shardIdx].estimatedDuration += duration;
      }
      shardIdx = (shardIdx + 1) % workerCount;
    }

    logger.info(`Sharded ${tests.length} tests across ${workerCount} workers (by-file)`);
    return shards;
  }

  /**
   * Tag-based sharding: group tests by tags
   */
  private shardByTag(tests: string[], workerCount: number): ExecutionShard[] {
    const shards: ExecutionShard[] = [];

    for (let i = 0; i < workerCount; i++) {
      shards.push({
        id: `shard-${Date.now()}-${i}`,
        workerId: '',
        tests: [],
        estimatedDuration: 0,
        retryCount: 0,
        tags: [],
      });
    }

    // Group tests by tags
    const tagGroups = new Map<string, string[]>();
    for (const test of tests) {
      const tags = this.testMetadata.get(test)?.tags ?? [];
      const primaryTag = tags[0] ?? 'untagged';

      if (!tagGroups.has(primaryTag)) {
        tagGroups.set(primaryTag, []);
      }
      tagGroups.get(primaryTag)!.push(test);
    }

    // Distribute tag groups round-robin
    let shardIdx = 0;
    for (const [tag, testGroup] of tagGroups.entries()) {
      for (const test of testGroup) {
        const duration = this.testMetadata.get(test)?.estimatedDuration ?? 5000;
        shards[shardIdx].tests.push(test);
        shards[shardIdx].estimatedDuration += duration;
        if (!shards[shardIdx].tags) shards[shardIdx].tags = [];
        if (!shards[shardIdx].tags!.includes(tag)) {
          shards[shardIdx].tags!.push(tag);
        }
      }
      shardIdx = (shardIdx + 1) % workerCount;
    }

    logger.info(`Sharded ${tests.length} tests across ${workerCount} workers (by-tag)`);
    return shards;
  }

  /**
   * Collect results from all shards
   */
  async collectResults(shards: ExecutionShard[]): Promise<ShardResult[]> {
    // In production, fetch results from workers
    // For now, return empty results structure
    return shards.map((shard) => ({
      shardId: shard.id,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      results: {},
    }));
  }

  /**
   * Rebalance shards based on actual metrics
   */
  rebalanceShards(
    shards: ExecutionShard[],
    metrics: ShardMetrics[]
  ): ExecutionShard[] {
    // Build metrics map
    const metricsMap = new Map(metrics.map((m) => [m.shardId, m]));

    // Find slowest shard
    let slowestShard = shards[0];
    let maxDuration = 0;

    for (const shard of shards) {
      const metric = metricsMap.get(shard.id);
      if (metric && metric.actualDuration > maxDuration) {
        maxDuration = metric.actualDuration;
        slowestShard = shard;
      }
    }

    // Find fastest shard
    let fastestShard = shards[0];
    let minDuration = Infinity;

    for (const shard of shards) {
      const metric = metricsMap.get(shard.id);
      const duration = metric?.actualDuration ?? shard.estimatedDuration;
      if (duration < minDuration) {
        minDuration = duration;
        fastestShard = shard;
      }
    }

    // If difference > 50%, move one test from slowest to fastest
    if (maxDuration - minDuration > maxDuration * 0.5 && slowestShard.tests.length > 1) {
      const testToMove = slowestShard.tests.pop()!;
      const duration = this.testMetadata.get(testToMove)?.estimatedDuration ?? 5000;

      slowestShard.estimatedDuration -= duration;
      fastestShard.tests.push(testToMove);
      fastestShard.estimatedDuration += duration;

      logger.info(
        `Rebalanced: moved test from ${slowestShard.id} to ${fastestShard.id}`
      );
    }

    return shards;
  }

  /**
   * Extract file path from test identifier
   */
  private extractFilePath(test: string): string {
    // Handle paths like "tests/auth.spec.ts::test-name"
    const parts = test.split('::');
    return parts[0].split('/').slice(0, -1).join('/');
  }
}
