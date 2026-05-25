import { Worker } from 'node:worker_threads';
import path from 'node:path';
import type { AgentConfig } from '../config.js';
import type { ApiClient } from '../lib/api-client.js';
import type { SkillManifest } from '@opensyber/shared';
import type { SecurityMonitor } from '../monitors/security.js';
import { SkillInstaller } from './installer.js';
import { createSandboxConfig } from './sandbox.js';
import type { SandboxConfig } from './sandbox.js';

interface RunningSkill {
  slug: string;
  worker: Worker;
  manifest: SkillManifest;
  startedAt: number;
}

export class SkillRunner {
  private installer: SkillInstaller;
  private api: ApiClient;
  private securityMonitor: SecurityMonitor | null;
  private running = new Map<string, RunningSkill>();
  private config: AgentConfig;

  constructor(config: AgentConfig, api: ApiClient, securityMonitor?: SecurityMonitor) {
    this.config = config;
    this.api = api;
    this.securityMonitor = securityMonitor ?? null;
    this.installer = new SkillInstaller(config, api);
  }

  async startSkill(
    slug: string,
    envSecrets: Record<string, string>,
  ): Promise<void> {
    if (this.running.has(slug)) {
      console.warn(`[SkillRunner] ${slug} is already running`);
      return;
    }

    const manifest = await this.installer.readManifest(slug);
    if (!manifest) {
      throw new Error(`Skill ${slug} not installed or missing manifest`);
    }

    const skillDir = this.installer.getSkillPath(slug);
    const entrypoint = path.join(skillDir, manifest.entrypoint);
    const sandbox = createSandboxConfig(manifest.permissions, skillDir, envSecrets);

    // UNC6426 hardening: pass ONLY sandbox env vars to the worker.
    // Setting env replaces process.env entirely — the skill cannot
    // read OPENSYBER_GATEWAY_TOKEN, AWS keys, or any host secrets.
    const worker = new Worker(entrypoint, {
      env: {
        ...sandbox.envVars,
        NODE_ENV: 'production',
        SKILL_SLUG: slug,
        SKILL_DIR: skillDir,
      },
      resourceLimits: {
        maxOldGenerationSizeMb: sandbox.resourceLimits.maxOldGenerationSizeMb,
        maxYoungGenerationSizeMb: sandbox.resourceLimits.maxYoungGenerationSizeMb,
        stackSizeMb: sandbox.resourceLimits.stackSizeMb,
      },
    });

    this.setupWorkerHandlers(slug, worker, sandbox);

    this.running.set(slug, {
      slug,
      worker,
      manifest,
      startedAt: Date.now(),
    });

    console.log(`[SkillRunner] Started ${slug}@${manifest.version}`);
  }

  private setupWorkerHandlers(
    slug: string,
    worker: Worker,
    _sandbox: SandboxConfig,
  ): void {
    worker.on('message', (msg: unknown) => {
      console.log(`[Skill:${slug}]`, msg);
    });

    worker.on('error', (err) => {
      console.error(`[Skill:${slug}] Error:`, err.message);
      this.running.delete(slug);

      // Report via SecurityMonitor if available, else direct API call
      if (this.securityMonitor) {
        this.securityMonitor.reportViolation(slug, 'unauthorized_network', {
          reason: err.message,
        });
      } else {
        this.api.reportSecurityEvents([{
          eventType: 'anomaly_detected',
          severity: 'warning',
          skillId: slug,
          details: JSON.stringify({ error: err.message }),
        }]).catch(() => {});
      }
    });

    worker.on('exit', (code) => {
      this.running.delete(slug);
      if (code !== 0) {
        console.warn(`[Skill:${slug}] Exited with code ${code}`);
      }
    });
  }

  async stopSkill(slug: string): Promise<void> {
    const skill = this.running.get(slug);
    if (!skill) return;

    await skill.worker.terminate();
    this.running.delete(slug);
    console.log(`[SkillRunner] Stopped ${slug}`);
  }

  async stopAll(): Promise<void> {
    for (const [slug] of this.running) {
      await this.stopSkill(slug);
    }
  }

  getRunningSkills(): string[] {
    return Array.from(this.running.keys());
  }

  isRunning(slug: string): boolean {
    return this.running.has(slug);
  }
}
