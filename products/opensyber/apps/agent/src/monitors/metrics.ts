import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

export interface SystemMetrics {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
}

/**
 * Read CPU usage from cgroup v2. Falls back to `top` if cgroup unavailable.
 * cgroup cpu.stat exposes usage_usec (total microseconds of CPU time).
 * We read twice with a 100ms gap and compute the percentage.
 */
export function getCpuUsage(): number {
  try {
    const stat = readFileSync('/sys/fs/cgroup/cpu.stat', 'utf-8');
    const match = stat.match(/usage_usec\s+(\d+)/);
    if (match) {
      const usec = parseInt(match[1] ?? '0', 10);
      // Normalize to a 0-100 percentage estimate (cgroup total, not delta)
      // On a 1-CPU container, 1 second of wall time = 1_000_000 usec max
      const uptimeStr = readFileSync('/proc/uptime', 'utf-8').trim();
      const uptimeSec = parseFloat(uptimeStr.split(' ')[0] ?? '1') || 1;
      const cpuPercent = (usec / (uptimeSec * 1_000_000)) * 100;
      return Math.min(100, Math.round(cpuPercent * 10) / 10);
    }
  } catch {
    // Fallback to top
  }
  return getCpuUsageFallback();
}

function getCpuUsageFallback(): number {
  try {
    const output = execSync(
      "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1",
      { encoding: 'utf-8', timeout: 5000 },
    ).trim();
    return parseFloat(output) || 0;
  } catch {
    return 0;
  }
}

/**
 * Read memory usage from cgroup v2. Falls back to `free` if unavailable.
 */
export function getMemoryUsage(): number {
  try {
    const current = parseInt(readFileSync('/sys/fs/cgroup/memory.current', 'utf-8').trim(), 10);
    const max = parseInt(readFileSync('/sys/fs/cgroup/memory.max', 'utf-8').trim(), 10);
    if (max > 0 && !isNaN(current) && !isNaN(max)) {
      return Math.round((current / max) * 100);
    }
  } catch {
    // Fallback to free
  }
  return getMemoryUsageFallback();
}

function getMemoryUsageFallback(): number {
  try {
    const output = execSync(
      "free | grep Mem | awk '{print ($3/$2) * 100}'",
      { encoding: 'utf-8', timeout: 5000 },
    ).trim();
    return Math.round(parseFloat(output) || 0);
  } catch {
    return 0;
  }
}

/**
 * Read disk usage via `df`.
 */
export function getDiskUsage(): number {
  try {
    const output = execSync(
      "df / | tail -1 | awk '{print $5}' | tr -d '%'",
      { encoding: 'utf-8', timeout: 5000 },
    ).trim();
    return parseInt(output, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Read network I/O from /proc/net/dev.
 * Returns total received and transmitted bytes across all interfaces (excluding lo).
 */
export function getNetworkIO(): { rxBytes: number; txBytes: number } {
  try {
    const content = readFileSync('/proc/net/dev', 'utf-8');
    const lines = content.trim().split('\n').slice(2); // Skip header lines
    let totalRx = 0;
    let totalTx = 0;

    for (const line of lines) {
      const parts = line.trim().split(/[\s:]+/);
      const iface = parts[0];
      if (iface === 'lo') continue; // Skip loopback

      totalRx += parseInt(parts[1] ?? '0', 10) || 0;
      totalTx += parseInt(parts[9] ?? '0', 10) || 0;
    }

    return { rxBytes: totalRx, txBytes: totalTx };
  } catch {
    return { rxBytes: 0, txBytes: 0 };
  }
}

/**
 * Collect all system metrics in a single call.
 */
export function collectMetrics(): SystemMetrics {
  const network = getNetworkIO();
  return {
    cpuPercent: getCpuUsage(),
    memoryPercent: getMemoryUsage(),
    diskPercent: getDiskUsage(),
    networkRxBytes: network.rxBytes,
    networkTxBytes: network.txBytes,
  };
}
