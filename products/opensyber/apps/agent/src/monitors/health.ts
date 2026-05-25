import { execSync } from 'node:child_process';
import type { AgentConfig } from '../config.js';
import type { ApiClient, DesiredSkill } from '../lib/api-client.js';
import type { SkillInstaller } from '../skills/installer.js';
import { collectMetrics } from './metrics.js';
import { LATEST_AGENT_VERSION } from '@opensyber/shared';

const AGENT_VERSION = LATEST_AGENT_VERSION;

export class HealthMonitor {
  private config: AgentConfig;
  private api: ApiClient;
  private installer: SkillInstaller | null;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: AgentConfig, api: ApiClient, installer?: SkillInstaller) {
    this.config = config;
    this.api = api;
    this.installer = installer ?? null;
  }

  start(): void {
    console.log('[HealthMonitor] Starting health checks every', this.config.healthCheckIntervalMs, 'ms');
    this.check(); // Immediate first check
    this.intervalId = setInterval(() => this.check(), this.config.healthCheckIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[HealthMonitor] Stopped');
  }

  private async check(): Promise<void> {
    try {
      const metrics = collectMetrics();
      const engineRunning = await this.isEngineRunning();
      const engineVersion = this.getEngineVersion();

      const response = await this.api.reportHealth({
        status: engineRunning ? 'running' : 'error',
        cpuPercent: metrics.cpuPercent,
        memoryPercent: metrics.memoryPercent,
        diskPercent: metrics.diskPercent,
        networkRxBytes: metrics.networkRxBytes,
        networkTxBytes: metrics.networkTxBytes,
        engineRunning,
        agentVersion: AGENT_VERSION,
        engineVersion,
      });

      console.log(
        `[HealthMonitor] Report sent — CPU: ${metrics.cpuPercent}%, MEM: ${metrics.memoryPercent}%, DISK: ${metrics.diskPercent}%, NET: ${metrics.networkRxBytes}rx/${metrics.networkTxBytes}tx, SyberEngine: ${engineRunning ? 'running' : 'DOWN'}`,
      );

      // Reconcile skills if installer is available
      if (this.installer && response.desiredSkills) {
        await this.reconcileSkills(response.desiredSkills);
      }

      // Auto-restart if SyberEngine is down
      if (!engineRunning) {
        console.warn('[HealthMonitor] SyberEngine is not running! Attempting restart...');
        this.restartEngine();
      }
    } catch (error) {
      console.error('[HealthMonitor] Health check failed:', error);
    }
  }

  private async reconcileSkills(desired: DesiredSkill[]): Promise<void> {
    if (!this.installer) return;

    const installed = await this.installer.listInstalled();
    const desiredSlugs = new Set(desired.map((s) => s.slug));

    // Install missing skills
    for (const skill of desired) {
      if (!installed.includes(skill.slug)) {
        try {
          const pkg = await this.api.downloadSkillPackage(skill.slug, skill.version);
          if (pkg) {
            await this.installer.install(
              skill.slug,
              pkg.packageBase64,
              pkg.packageSha256,
              pkg.packageSignature,
            );
            console.log(`[HealthMonitor] Installed skill ${skill.slug}@${skill.version}`);
          }
        } catch (err) {
          console.error(`[HealthMonitor] Failed to install skill ${skill.slug}:`, err);
        }
      }
    }

    // Uninstall removed skills
    for (const slug of installed) {
      if (!desiredSlugs.has(slug)) {
        try {
          await this.installer.uninstall(slug);
          console.log(`[HealthMonitor] Uninstalled skill ${slug}`);
        } catch (err) {
          console.error(`[HealthMonitor] Failed to uninstall skill ${slug}:`, err);
        }
      }
    }
  }

  private async isEngineRunning(): Promise<boolean> {
    try {
      const response = await fetch(this.config.engineGatewayUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private getEngineVersion(): string {
    try {
      const output = execSync('docker inspect syber-engine --format "{{.Config.Image}}"', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      // Extract version from image tag
      const parts = output.split(':');
      return parts[1] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private restartEngine(): void {
    try {
      execSync('docker restart syber-engine', { timeout: 30000 });
      console.log('[HealthMonitor] SyberEngine restarted successfully');
    } catch (error) {
      console.error('[HealthMonitor] Failed to restart SyberEngine:', error);
    }
  }
}
