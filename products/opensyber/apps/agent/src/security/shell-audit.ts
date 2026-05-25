import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { ApiClient } from '../lib/api-client.js';

export interface AuditEntry {
  timestamp: string;
  user: string;
  command: string;
  workingDir: string;
  exitCode: number;
}

/**
 * Monitors shell command execution via auditd log parsing.
 * Reports all executions to the API for auditing.
 */
export class ShellAuditor {
  private api: ApiClient;
  private instanceId: string;
  private logPath: string;
  private watching = false;
  private buffer: AuditEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(api: ApiClient, instanceId: string, logPath = '/var/log/audit/audit.log') {
    this.api = api;
    this.instanceId = instanceId;
    this.logPath = logPath;
  }

  start(): void {
    if (this.watching) return;
    this.watching = true;

    // Flush buffer every 30 seconds
    this.flushInterval = setInterval(() => this.flush(), 30000);

    // Start tailing the audit log
    this.tailLog();
    console.log('[ShellAuditor] Started monitoring shell commands');
  }

  stop(): void {
    this.watching = false;
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
    console.log('[ShellAuditor] Stopped');
  }

  /**
   * Parse a single audit log line for execve syscalls.
   */
  parseAuditLine(line: string): AuditEntry | null {
    // Match execve audit entries
    // Format: type=EXECVE msg=audit(timestamp:id): argc=N a0="cmd" a1="arg"...
    if (!line.includes('type=EXECVE') && !line.includes('type=SYSCALL')) {
      return null;
    }

    const timestampMatch = line.match(/msg=audit\((\d+\.\d+):/);
    const cmdMatch = line.match(/a0="([^"]+)"/);
    const userMatch = line.match(/uid=(\d+)/);
    const cwdMatch = line.match(/cwd="([^"]+)"/);
    const exitMatch = line.match(/exit=(\d+)/);

    if (!cmdMatch) return null;

    // Reconstruct full command from a0, a1, a2... arguments
    const args: string[] = [];
    let i = 0;
    while (true) {
      const argMatch = line.match(new RegExp(`a${i}="([^"]+)"`));
      if (!argMatch?.[1]) break;
      args.push(argMatch[1]);
      i++;
    }

    const timestamp = timestampMatch?.[1]
      ? new Date(parseFloat(timestampMatch[1]) * 1000).toISOString()
      : new Date().toISOString();

    return {
      timestamp,
      user: userMatch?.[1] ?? 'unknown',
      command: args.join(' ') || cmdMatch[1] || 'unknown',
      workingDir: cwdMatch?.[1] ?? '/',
      exitCode: exitMatch?.[1] ? parseInt(exitMatch[1], 10) : 0,
    };
  }

  private tailLog(): void {
    try {
      const stream = createReadStream(this.logPath, { encoding: 'utf-8' });
      const rl = createInterface({ input: stream });

      rl.on('line', (line) => {
        if (!this.watching) return;
        const entry = this.parseAuditLine(line);
        if (entry) {
          this.buffer.push(entry);
        }
      });

      rl.on('close', () => {
        // Log file rotated or closed; re-open after delay
        if (this.watching) {
          setTimeout(() => this.tailLog(), 5000);
        }
      });

      rl.on('error', (err) => {
        console.error('[ShellAuditor] Error reading audit log:', err.message);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ShellAuditor] Cannot open ${this.logPath}: ${msg}`);
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    const events = entries.map((entry) => ({
      eventType: 'credential_access' as const,
      severity: 'info' as const,
      details: JSON.stringify({
        type: 'shell_exec',
        command: entry.command,
        user: entry.user,
        workingDir: entry.workingDir,
        exitCode: entry.exitCode,
        timestamp: entry.timestamp,
      }),
    }));

    try {
      await this.api.reportSecurityEvents(events);
      console.log(`[ShellAuditor] Reported ${entries.length} commands`);
    } catch {
      // Put entries back on failure
      this.buffer.unshift(...entries);
    }
  }
}
