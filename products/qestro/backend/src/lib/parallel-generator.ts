/**
 * Parallel Test Generator — Agent of Empires pattern
 *
 * Spawns N isolated workers to generate tests in parallel.
 * Each worker runs independently with no shared state.
 * Results are collected, deduplicated, and merged.
 *
 * Reference: https://github.com/njbrake/agent-of-empires
 */

import { logger } from '../utils/logger.js';

export interface GenerationTask {
  id: string;
  url: string;
  description: string;
  framework?: 'playwright' | 'cypress' | 'puppeteer';
  metadata?: Record<string, unknown>;
}

export interface GenerationResult {
  taskId: string;
  success: boolean;
  testCode?: string;
  confidence?: number;
  tokensUsed?: number;
  durationMs: number;
  error?: string;
  workerId: number;
}

export interface BatchProgress {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  inProgress: number;
}

export type ProgressCallback = (progress: BatchProgress) => void;

/** Single test generation function — caller provides the actual logic */
export type GeneratorFn = (task: GenerationTask) => Promise<{
  testCode: string;
  confidence: number;
  tokensUsed: number;
}>;

export interface ParallelGeneratorConfig {
  /** Max parallel workers (default 5) */
  maxWorkers?: number;
  /** Timeout per task in ms (default 60_000) */
  taskTimeout?: number;
  /** Progress callback fired after each task completes */
  onProgress?: ProgressCallback;
}

/**
 * Run generation tasks in parallel with bounded concurrency
 */
export async function generateInParallel(
  tasks: GenerationTask[],
  generator: GeneratorFn,
  config: ParallelGeneratorConfig = {},
): Promise<GenerationResult[]> {
  const maxWorkers = config.maxWorkers ?? 5;
  const taskTimeout = config.taskTimeout ?? 60_000;
  const results: GenerationResult[] = [];
  const progress: BatchProgress = {
    total: tasks.length,
    completed: 0,
    succeeded: 0,
    failed: 0,
    inProgress: 0,
  };

  logger.info('Parallel generation started', {
    tasks: tasks.length,
    maxWorkers,
  });

  // Worker pool pattern — pull tasks from queue
  const queue = [...tasks];
  const workers: Promise<void>[] = [];

  const runWorker = async (workerId: number): Promise<void> => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      progress.inProgress++;
      config.onProgress?.(progress);

      const start = Date.now();
      try {
        const result = await withTimeout(generator(task), taskTimeout);
        results.push({
          taskId: task.id,
          success: true,
          testCode: result.testCode,
          confidence: result.confidence,
          tokensUsed: result.tokensUsed,
          durationMs: Date.now() - start,
          workerId,
        });
        progress.succeeded++;
      } catch (err) {
        results.push({
          taskId: task.id,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
          workerId,
        });
        progress.failed++;
      } finally {
        progress.inProgress--;
        progress.completed++;
        config.onProgress?.(progress);
      }
    }
  };

  for (let i = 0; i < maxWorkers; i++) {
    workers.push(runWorker(i));
  }
  await Promise.all(workers);

  logger.info('Parallel generation complete', {
    total: progress.total,
    succeeded: progress.succeeded,
    failed: progress.failed,
  });

  // Return results in task order (not completion order)
  return tasks
    .map((t) => results.find((r) => r.taskId === t.id)!)
    .filter(Boolean);
}

/**
 * Deduplicate generation results by test code similarity
 * Keeps the highest-confidence version when duplicates are found
 */
export function deduplicateResults(
  results: GenerationResult[],
): GenerationResult[] {
  const byCodeHash = new Map<string, GenerationResult>();

  for (const result of results) {
    if (!result.success || !result.testCode) continue;

    // Simple hash: normalize whitespace and lowercase
    const hash = result.testCode
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim()
      .slice(0, 500); // First 500 chars should be distinctive

    const existing = byCodeHash.get(hash);
    if (!existing || (result.confidence ?? 0) > (existing.confidence ?? 0)) {
      byCodeHash.set(hash, result);
    }
  }

  return Array.from(byCodeHash.values());
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Task timeout after ${ms}ms`)), ms),
    ),
  ]);
}
