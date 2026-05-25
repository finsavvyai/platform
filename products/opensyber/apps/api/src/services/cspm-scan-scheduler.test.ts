/**
 * CSPM Scan Scheduler Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cspmScanScheduler } from './cspm-scan-scheduler';
import type { Db } from './cspm-scan-scheduler';

// Mock the cspm-scanner
vi.mock('./cspm-scanner.js', () => ({
  runCspmScan: vi.fn(),
}));

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));

import { calculateNextScanTime, processScheduledScans, scheduleImmediateScan } from './cspm-scan-scheduler.js';
import { runCspmScan } from './cspm-scanner.js';

const mockRunCspmScan = runCspmScan as unknown as ReturnType<typeof vi.fn>;

describe('calculateNextScanTime', () => {
  it('returns null for manual schedule', () => {
    expect(calculateNextScanTime('manual')).toBeNull();
    expect(calculateNextScanTime('manual', '2025-03-01T00:00:00Z')).toBeNull();
  });

  it('calculates next day for daily schedule', () => {
    const result = calculateNextScanTime('daily', '2025-03-01T10:00:00Z');
    expect(result).toMatch(/^2025-03-02T10:00:00/);
  });

  it('calculates next week for weekly schedule', () => {
    const result = calculateNextScanTime('weekly', '2025-03-01T10:00:00Z');
    expect(result).toMatch(/^2025-03-08T10:00:00/);
  });

  it('uses current time when lastScanAt is not provided', () => {
    const before = new Date();
    const result = calculateNextScanTime('daily');
    const after = new Date();

    // Should be approximately 1 day from now
    const nextTime = new Date(result!);
    const diff = nextTime.getTime() - before.getTime();
    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000); // at least 23 hours
    expect(diff).toBeLessThan(25 * 60 * 60 * 1000); // at most 25 hours
  });
});

describe('processScheduledScans', () => {
  let mockDb: Db;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
    } as unknown as Db;
    (globalThis as any).__mockDb = mockDb;
  });

  it('returns empty array when no accounts are due', async () => {
    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const results = await processScheduledScans(mockDb);
    expect(results).toEqual([]);
  });

  it('processes a single scheduled scan successfully', async () => {
    const account = {
      id: 'acc-1',
      orgId: 'org-1',
      provider: 'aws',
      name: 'Test Account',
      roleArn: 'arn:aws:iam::123:role/MyRole',
      externalId: null,
      credentials: null,
      status: 'active',
      scanSchedule: 'daily',
      nextScanAt: '2025-03-01T00:00:00Z',
      lastScanAt: null,
      createdAt: '2025-02-28T00:00:00Z',
    };

    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([account]),
        }),
      }),
    });

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockDb.update = vi.fn().mockReturnValue(updateChain);

    mockRunCspmScan.mockResolvedValue({
      scanRun: {
        id: 'scan-1',
        status: 'completed',
        findingCount: 5,
        criticalCount: 1,
        highCount: 2,
        mediumCount: 1,
        lowCount: 1,
      },
    });

    const results = await processScheduledScans(mockDb, { now: '2025-03-01T00:00:00Z' });

    expect(results).toHaveLength(1);
    expect(results[0].accountId).toBe('acc-1');
    expect(results[0].success).toBe(true);
    expect(results[0].scanRunId).toBe('scan-1');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[ScanScheduler] Scheduled scan completed for account acc-1: 5 findings',
    );
  });

  it('handles scan failure gracefully', async () => {
    const account = {
      id: 'acc-1',
      orgId: 'org-1',
      provider: 'aws',
      name: 'Test Account',
      roleArn: 'arn:aws:iam::123:role/MyRole',
      externalId: null,
      credentials: null,
      status: 'active',
      scanSchedule: 'daily',
      nextScanAt: '2025-03-01T00:00:00Z',
      lastScanAt: null,
      createdAt: '2025-02-28T00:00:00Z',
    };

    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([account]),
        }),
      }),
    });

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockDb.update = vi.fn().mockReturnValue(updateChain);

    mockRunCspmScan.mockResolvedValue({
      scanRun: {
        id: '',
        status: 'failed',
        findingCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      },
      error: 'Authentication failed',
    });

    const results = await processScheduledScans(mockDb, { now: '2025-03-01T00:00:00Z' });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe('Authentication failed');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ScanScheduler] Scheduled scan failed for account acc-1: Authentication failed',
    );
  });

  it('respects maxConcurrent limit', async () => {
    const accounts = Array.from({ length: 10 }, (_, i) => ({
      id: `acc-${i}`,
      orgId: 'org-1',
      provider: 'aws',
      name: `Account ${i}`,
      roleArn: 'arn:aws:iam::123:role/MyRole',
      externalId: null,
      credentials: null,
      status: 'active',
      scanSchedule: 'daily',
      nextScanAt: '2025-03-01T00:00:00Z',
      lastScanAt: null,
      createdAt: '2025-02-28T00:00:00Z',
    }));

    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation((limit: number) => {
            return Promise.resolve(accounts.slice(0, limit));
          }),
        }),
      }),
    });

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockDb.update = vi.fn().mockReturnValue(updateChain);

    mockRunCspmScan.mockResolvedValue({
      scanRun: {
        id: 'scan-1',
        status: 'completed',
        findingCount: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      },
    });

    const results = await processScheduledScans(mockDb, { maxConcurrent: 5 });

    expect(results).toHaveLength(5);
  });

  it('processes multiple scans in parallel', async () => {
    const accounts = [
      {
        id: 'acc-1',
        orgId: 'org-1',
        provider: 'aws',
        name: 'Account 1',
        roleArn: 'arn:aws:iam::123:role/MyRole',
        externalId: null,
        credentials: null,
        status: 'active',
        scanSchedule: 'daily',
        nextScanAt: '2025-03-01T00:00:00Z',
        lastScanAt: null,
        createdAt: '2025-02-28T00:00:00Z',
      },
      {
        id: 'acc-2',
        orgId: 'org-1',
        provider: 'aws',
        name: 'Account 2',
        roleArn: 'arn:aws:iam::123:role/MyRole',
        externalId: null,
        credentials: null,
        status: 'active',
        scanSchedule: 'weekly',
        nextScanAt: '2025-03-01T00:00:00Z',
        lastScanAt: null,
        createdAt: '2025-02-28T00:00:00Z',
      },
    ];

    mockDb.select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(accounts),
        }),
      }),
    });

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockDb.update = vi.fn().mockReturnValue(updateChain);

    mockRunCspmScan.mockResolvedValue({
      scanRun: {
        id: 'scan-1',
        status: 'completed',
        findingCount: 3,
        criticalCount: 0,
        highCount: 1,
        mediumCount: 1,
        lowCount: 1,
      },
    });

    const results = await processScheduledScans(mockDb, { now: '2025-03-01T00:00:00Z' });

    expect(results).toHaveLength(2);
    expect(results[0].accountId).toBe('acc-1');
    expect(results[1].accountId).toBe('acc-2');
  });
});

describe('scheduleImmediateScan', () => {
  it('sets nextScanAt to current time', async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    const mockDb = {
      update: vi.fn().mockReturnValue(updateChain),
    } as unknown as Db;

    await scheduleImmediateScan(mockDb, 'acc-1');

    expect(mockDb.update).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      nextScanAt: expect.stringMatching(/\d{4}-\d{2}-\d{2}T/),
    }));
    expect(updateChain.where).toHaveBeenCalledWith(expect.anything());
  });
});
