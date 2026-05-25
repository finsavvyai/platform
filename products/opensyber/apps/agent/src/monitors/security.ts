import { watch, type FSWatcher } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentConfig } from '../config.js';
import type { ApiClient } from '../lib/api-client.js';

export interface SecurityEvent {
  eventType: string;
  severity: string;
  skillId?: string;
  details?: string;
}

export type ViolationType = 'unauthorized_network' | 'file_access_violation' | 'credential_access';

export class SecurityMonitor {
  private config: AgentConfig;
  private api: ApiClient;
  private watchers: FSWatcher[] = [];
  private eventBuffer: SecurityEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: AgentConfig, api: ApiClient) {
    this.config = config;
    this.api = api;
  }

  start(): void {
    console.log('[SecurityMonitor] Starting security monitoring');

    // Watch credential files
    this.watchCredentials();

    // Watch for skill installations
    this.watchSkillDirectory();

    // Flush events periodically
    this.flushInterval = setInterval(() => this.flushEvents(), 10000);
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushEvents(); // Final flush
    console.log('[SecurityMonitor] Stopped');
  }

  private watchCredentials(): void {
    const credPaths = [
      join(this.config.engineConfigDir, 'config'),
      join(this.config.engineConfigDir, 'credentials'),
    ];

    for (const path of credPaths) {
      try {
        const watcher = watch(path, (eventType) => {
          this.addEvent({
            eventType: 'credential_access',
            severity: 'warning',
            details: JSON.stringify({
              path,
              fsEvent: eventType,
              timestamp: new Date().toISOString(),
            }),
          });
          console.warn(`[SecurityMonitor] Credential file ${eventType}: ${path}`);
        });
        this.watchers.push(watcher);
        console.log(`[SecurityMonitor] Watching credentials: ${path}`);
      } catch {
        // File may not exist yet
        console.log(`[SecurityMonitor] Credential file not found (will monitor on creation): ${path}`);
      }
    }
  }

  private watchSkillDirectory(): void {
    const skillDir = join(this.config.engineConfigDir, 'skills');

    try {
      const watcher = watch(skillDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        this.addEvent({
          eventType: 'skill_installed',
          severity: 'info',
          details: JSON.stringify({
            filename,
            fsEvent: eventType,
            timestamp: new Date().toISOString(),
          }),
        });
        console.log(`[SecurityMonitor] Skill directory change: ${eventType} ${filename}`);
      });
      this.watchers.push(watcher);
      console.log(`[SecurityMonitor] Watching skill directory: ${skillDir}`);
    } catch {
      console.log(`[SecurityMonitor] Skill directory not found: ${skillDir}`);
    }
  }

  private addEvent(event: SecurityEvent): void {
    this.eventBuffer.push(event);

    // Immediately flush critical events
    if (event.severity === 'critical') {
      this.flushEvents();
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await this.api.reportSecurityEvents(events);
      console.log(`[SecurityMonitor] Flushed ${events.length} security events`);
    } catch (error) {
      // Put events back if flush fails
      this.eventBuffer.unshift(...events);
      console.error('[SecurityMonitor] Failed to flush events:', error);
    }
  }

  /**
   * Report a skill sandbox violation. Called by SkillRunner/Sandbox when
   * a skill attempts unauthorized access.
   */
  reportViolation(
    skillSlug: string,
    type: ViolationType,
    detail: { target?: string; reason?: string },
  ): void {
    this.addEvent({
      eventType: type,
      severity: type === 'credential_access' ? 'critical' : 'warning',
      skillId: skillSlug,
      details: JSON.stringify({
        slug: skillSlug,
        violationType: type,
        ...detail,
        timestamp: new Date().toISOString(),
      }),
    });
    console.warn(`[SecurityMonitor] Violation by ${skillSlug}: ${type} → ${detail.target ?? 'unknown'}`);
  }

  /** Get buffered events count (for testing/metrics). */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }

  /**
   * Scan installed skills against verified allowlist
   */
  async scanSkills(verifiedSlugs: string[]): Promise<void> {
    const skillDir = join(this.config.engineConfigDir, 'skills');

    try {
      const entries = await readdir(skillDir);

      for (const entry of entries) {
        const entryPath = join(skillDir, entry);
        const entryStat = await stat(entryPath);

        if (entryStat.isDirectory()) {
          const isVerified = verifiedSlugs.includes(entry);

          if (!isVerified) {
            this.addEvent({
              eventType: 'skill_blocked',
              severity: 'warning',
              skillId: entry,
              details: JSON.stringify({
                slug: entry,
                reason: 'Skill is not in the OpenSyber verified list',
                action: 'blocked',
              }),
            });
            console.warn(`[SecurityMonitor] Unverified skill detected: ${entry}`);
          }
        }
      }
    } catch {
      // Skill directory may not exist
    }
  }
}
