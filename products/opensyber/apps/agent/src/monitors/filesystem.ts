import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import type { AgentConfig } from '../config.js';
import type { ApiClient } from '../lib/api-client.js';

export interface FileBaseline {
  filePath: string;
  sha256: string;
  permissions: string;
  size: number;
}

export interface FileChangeEvent {
  filePath: string;
  changeType: 'modified' | 'created' | 'deleted' | 'permissions_changed';
  previousHash?: string;
  currentHash?: string;
  details?: string;
}

const CRITICAL_PATHS = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/ssh/sshd_config',
  '/etc/hosts',
  '/etc/resolv.conf',
];

/**
 * Monitors file integrity using SHA256 baselines.
 * Detects unauthorized changes to critical system files and skill directories.
 */
export class FilesystemMonitor {
  private config: AgentConfig;
  private api: ApiClient;
  private baselines = new Map<string, FileBaseline>();
  private watchers: FSWatcher[] = [];
  private changeBuffer: FileChangeEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor(config: AgentConfig, api: ApiClient) {
    this.config = config;
    this.api = api;
  }

  async start(): Promise<void> {
    console.log('[FilesystemMonitor] Starting file integrity monitoring');

    // Generate initial baselines
    await this.generateBaselines();

    // Watch critical paths
    this.watchPaths();

    // Periodic integrity scan every 5 minutes
    this.scanInterval = setInterval(() => this.verifyIntegrity(), 5 * 60 * 1000);

    // Flush change events every 30 seconds
    this.flushInterval = setInterval(() => this.flushChanges(), 30000);
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    if (this.scanInterval) clearInterval(this.scanInterval);
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flushChanges();
    console.log('[FilesystemMonitor] Stopped');
  }

  /**
   * Generate SHA256 baselines for all monitored paths.
   */
  async generateBaselines(): Promise<FileBaseline[]> {
    const monitoredPaths = [
      ...CRITICAL_PATHS,
      path.join(this.config.engineConfigDir, 'config'),
    ];

    const results: FileBaseline[] = [];

    for (const filePath of monitoredPaths) {
      try {
        const baseline = await this.hashFile(filePath);
        this.baselines.set(filePath, baseline);
        results.push(baseline);
      } catch {
        // File doesn't exist yet — skip
      }
    }

    console.log(`[FilesystemMonitor] Generated ${results.length} baselines`);
    return results;
  }

  /**
   * Verify current state against baselines. Report drifts.
   */
  async verifyIntegrity(): Promise<FileChangeEvent[]> {
    const changes: FileChangeEvent[] = [];

    for (const [filePath, baseline] of this.baselines) {
      try {
        const current = await this.hashFile(filePath);

        if (current.sha256 !== baseline.sha256) {
          changes.push({
            filePath,
            changeType: 'modified',
            previousHash: baseline.sha256,
            currentHash: current.sha256,
          });
          // Update baseline to current
          this.baselines.set(filePath, current);
        } else if (current.permissions !== baseline.permissions) {
          changes.push({
            filePath,
            changeType: 'permissions_changed',
            details: `${baseline.permissions} → ${current.permissions}`,
          });
          this.baselines.set(filePath, current);
        }
      } catch {
        changes.push({
          filePath,
          changeType: 'deleted',
          previousHash: baseline.sha256,
        });
        this.baselines.delete(filePath);
      }
    }

    if (changes.length > 0) {
      this.changeBuffer.push(...changes);
      console.warn(`[FilesystemMonitor] ${changes.length} integrity changes detected`);
    }

    return changes;
  }

  private watchPaths(): void {
    for (const filePath of CRITICAL_PATHS) {
      try {
        const dir = path.dirname(filePath);
        const filename = path.basename(filePath);
        const watcher = watch(dir, (event, changedFile) => {
          if (changedFile === filename) {
            this.changeBuffer.push({
              filePath,
              changeType: event === 'rename' ? 'deleted' : 'modified',
            });
          }
        });
        this.watchers.push(watcher);
      } catch {
        // Directory may not exist
      }
    }
  }

  private async hashFile(filePath: string): Promise<FileBaseline> {
    const content = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);
    const hash = createHash('sha256').update(content).digest('hex');
    const permissions = `0${(stats.mode & 0o777).toString(8)}`;

    return {
      filePath,
      sha256: hash,
      permissions,
      size: stats.size,
    };
  }

  private async flushChanges(): Promise<void> {
    if (this.changeBuffer.length === 0) return;

    const changes = [...this.changeBuffer];
    this.changeBuffer = [];

    const events = changes.map((change) => ({
      eventType: 'file_access_violation' as const,
      severity: 'warning' as const,
      details: JSON.stringify(change),
    }));

    try {
      await this.api.reportSecurityEvents(events);
    } catch {
      this.changeBuffer.unshift(...changes);
    }
  }
}
