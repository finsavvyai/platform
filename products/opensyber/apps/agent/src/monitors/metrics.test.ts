import { describe, it, expect, vi, beforeEach } from 'vitest';

const readFileSyncMock = vi.fn();
const execSyncMock = vi.fn();

vi.mock('node:fs', () => ({
  readFileSync: (...args: unknown[]) => readFileSyncMock(...args),
}));

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => execSyncMock(...args),
}));

const { getCpuUsage, getMemoryUsage, getDiskUsage, getNetworkIO, collectMetrics } =
  await import('./metrics.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCpuUsage', () => {
  it('reads from cgroup cpu.stat when available', () => {
    readFileSyncMock
      .mockReturnValueOnce('usage_usec 5000000\n') // cpu.stat
      .mockReturnValueOnce('10.0 0.5\n'); // /proc/uptime (10 seconds)

    const result = getCpuUsage();
    // 5_000_000 usec / (10 * 1_000_000) = 0.5 = 50%
    expect(result).toBe(50);
  });

  it('falls back to execSync when cgroup unavailable', () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    execSyncMock.mockReturnValueOnce('25.3\n');

    const result = getCpuUsage();
    expect(result).toBe(25.3);
    expect(execSyncMock).toHaveBeenCalled();
  });

  it('returns 0 when all methods fail', () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    execSyncMock.mockImplementation(() => {
      throw new Error('command not found');
    });

    expect(getCpuUsage()).toBe(0);
  });
});

describe('getMemoryUsage', () => {
  it('reads from cgroup memory.current and memory.max', () => {
    readFileSyncMock
      .mockReturnValueOnce('524288000\n') // memory.current (500 MB)
      .mockReturnValueOnce('1073741824\n'); // memory.max (1 GB)

    const result = getMemoryUsage();
    // 500MB / 1GB = 49% (rounds to 49)
    expect(result).toBe(49);
  });

  it('falls back to free when cgroup unavailable', () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    execSyncMock.mockReturnValueOnce('62.5\n');

    const result = getMemoryUsage();
    expect(result).toBe(63); // Math.round(62.5)
  });

  it('returns 0 when all methods fail', () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    execSyncMock.mockImplementation(() => {
      throw new Error('command not found');
    });

    expect(getMemoryUsage()).toBe(0);
  });
});

describe('getDiskUsage', () => {
  it('reads from df command', () => {
    execSyncMock.mockReturnValueOnce('42\n');
    expect(getDiskUsage()).toBe(42);
  });

  it('returns 0 on failure', () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('failed');
    });
    expect(getDiskUsage()).toBe(0);
  });
});

describe('getNetworkIO', () => {
  it('parses /proc/net/dev and sums interfaces (excluding lo)', () => {
    readFileSyncMock.mockReturnValueOnce(
      `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 12345   100   0    0    0     0          0         0    67890    200   0    0    0     0       0          0
  eth0: 50000   300   0    0    0     0          0         0    25000    150   0    0    0     0       0          0
  eth1: 10000   50    0    0    0     0          0         0     5000     30   0    0    0     0       0          0`,
    );

    const result = getNetworkIO();
    // eth0 + eth1 only (lo excluded)
    expect(result.rxBytes).toBe(60000); // 50000 + 10000
    expect(result.txBytes).toBe(30000); // 25000 + 5000
  });

  it('returns zeros when /proc/net/dev is unavailable', () => {
    readFileSyncMock.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const result = getNetworkIO();
    expect(result.rxBytes).toBe(0);
    expect(result.txBytes).toBe(0);
  });
});

describe('collectMetrics', () => {
  it('returns all metrics in one call', () => {
    // Call order in collectMetrics: getNetworkIO, getCpuUsage, getMemoryUsage, getDiskUsage
    readFileSyncMock
      // 1. getNetworkIO → /proc/net/dev
      .mockReturnValueOnce(
        `Inter-|   Receive\n face |bytes\n  eth0: 1000 0 0 0 0 0 0 0 2000 0 0 0 0 0 0 0`,
      )
      // 2. getCpuUsage → cpu.stat
      .mockReturnValueOnce('usage_usec 2000000\n')
      // 3. getCpuUsage → /proc/uptime
      .mockReturnValueOnce('10.0 0.5\n')
      // 4. getMemoryUsage → memory.current
      .mockReturnValueOnce('256000000\n')
      // 5. getMemoryUsage → memory.max
      .mockReturnValueOnce('1073741824\n');
    execSyncMock.mockReturnValueOnce('35\n'); // df for disk

    const result = collectMetrics();
    expect(result.cpuPercent).toBeDefined();
    expect(result.memoryPercent).toBeDefined();
    expect(result.diskPercent).toBe(35);
    expect(result.networkRxBytes).toBe(1000);
    expect(result.networkTxBytes).toBe(2000);
  });
});
