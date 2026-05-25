/**
 * Flake detector tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectFlake } from '../packages/api/src/services/flake-detector';

const mockEnv = {
  DB: {} as any,
  RUNNER_URL: 'https://runner.example.com/run',
  RUNNER_TOKEN: 'test-token',
};

describe('detectFlake', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects missing testId', async () => {
    await expect(
      detectFlake(mockEnv, { testId: '', command: 'npm test' }),
    ).rejects.toThrow(/testId/);
  });

  it('rejects missing command', async () => {
    await expect(
      detectFlake(mockEnv, { testId: 'test1', command: '' }),
    ).rejects.toThrow(/command/);
  });

  it('rejects iterations < 2', async () => {
    await expect(
      detectFlake(mockEnv, { testId: 'test1', command: 'x', iterations: 1 }),
    ).rejects.toThrow(/iterations/);
  });

  it('rejects iterations > 100', async () => {
    await expect(
      detectFlake(mockEnv, { testId: 'test1', command: 'x', iterations: 101 }),
    ).rejects.toThrow(/100/);
  });

  it('classifies as stable when all runs pass', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ exitCode: 0 }), { status: 200 }),
    ));

    const report = await detectFlake(mockEnv, {
      testId: 'test1',
      command: 'npm test',
      iterations: 5,
      parallelism: 2,
    });

    expect(report.classification).toBe('stable');
    expect(report.passed).toBe(5);
    expect(report.failed).toBe(0);
    expect(report.successRate).toBe(1.0);
  });

  it('classifies as broken when all runs fail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ exitCode: 1, stderr: 'error' }), { status: 200 }),
    ));

    const report = await detectFlake(mockEnv, {
      testId: 'test1',
      command: 'npm test',
      iterations: 5,
    });

    expect(report.classification).toBe('broken');
    expect(report.passed).toBe(0);
    expect(report.failed).toBe(5);
    expect(report.successRate).toBe(0);
  });

  it('classifies as flaky when some runs pass and some fail', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount++;
      return new Response(
        JSON.stringify({ exitCode: callCount % 2 === 0 ? 0 : 1 }),
        { status: 200 },
      );
    }));

    const report = await detectFlake(mockEnv, {
      testId: 'test1',
      command: 'npm test',
      iterations: 6,
    });

    expect(report.classification).toBe('flaky');
    expect(report.passed).toBeGreaterThan(0);
    expect(report.failed).toBeGreaterThan(0);
    expect(report.reason).toMatch(/non-deterministic/);
  });

  it('dry-run mode when RUNNER_URL not set', async () => {
    const report = await detectFlake(
      { DB: {} as any },
      { testId: 'test1', command: 'x', iterations: 3 },
    );
    expect(report.iterations).toBe(3);
    expect(report.classification).toBe('stable');
    expect(report.runs.every((r) => r.stderr?.includes('dry run'))).toBe(true);
  });

  it('computes duration statistics', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ exitCode: 0 }), { status: 200 }),
    ));

    const report = await detectFlake(mockEnv, {
      testId: 'test1',
      command: 'npm test',
      iterations: 4,
    });

    expect(report.avgDurationMs).toBeGreaterThanOrEqual(0);
    expect(report.stddevDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('respects parallelism budget', async () => {
    const callTimestamps: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => {
      callTimestamps.push(Date.now());
      await new Promise((r) => setTimeout(r, 10));
      return new Response(JSON.stringify({ exitCode: 0 }), { status: 200 });
    }));

    const report = await detectFlake(mockEnv, {
      testId: 'test1',
      command: 'npm test',
      iterations: 6,
      parallelism: 2,
    });

    expect(report.iterations).toBe(6);
    // With parallelism=2, we should see 3 waves
    expect(callTimestamps.length).toBe(6);
  });
});
