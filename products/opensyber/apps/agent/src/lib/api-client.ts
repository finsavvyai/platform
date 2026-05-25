import type { AgentConfig } from '../config.js';

export interface DesiredSkill {
  slug: string;
  version: string;
}

export interface HealthResponse {
  received: boolean;
  desiredSkills: DesiredSkill[];
}

export class ApiClient {
  private baseUrl: string;
  private token: string;
  private instanceId: string;

  constructor(config: AgentConfig) {
    this.baseUrl = config.apiBaseUrl;
    this.token = config.gatewayToken;
    this.instanceId = config.instanceId;
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Token': this.token,
        'X-Instance-Id': this.instanceId,
        ...options.headers,
      },
    });
    return response;
  }

  async reportHealth(data: {
    status: string;
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    networkRxBytes?: number;
    networkTxBytes?: number;
    engineRunning: boolean;
    agentVersion: string;
    engineVersion: string;
  }): Promise<HealthResponse> {
    const response = await this.request('/webhooks/agent/health', {
      method: 'POST',
      body: JSON.stringify({
        instanceId: this.instanceId,
        ...data,
      }),
    });
    if (!response.ok) {
      return { received: false, desiredSkills: [] };
    }
    return response.json() as Promise<HealthResponse>;
  }

  async reportSecurityEvents(
    events: Array<{
      eventType: string;
      severity: string;
      skillId?: string;
      details?: string;
    }>,
  ): Promise<void> {
    if (events.length === 0) return;

    await this.request(`/api/security/instances/${this.instanceId}/events`, {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  async checkForUpdates(): Promise<{
    engineVersion?: string;
    agentVersion?: string;
    action?: 'update' | 'restart' | 'none';
  }> {
    const response = await this.request(`/api/instances/${this.instanceId}/updates`);
    if (!response.ok) return { action: 'none' };
    return response.json();
  }

  async getVerifiedSkills(): Promise<string[]> {
    const response = await this.request('/api/skills?verified=true');
    if (!response.ok) return [];
    const data = (await response.json()) as { skills: Array<{ slug: string }> };
    return data.skills.map((s) => s.slug);
  }

  async downloadSkillPackage(slug: string, version: string): Promise<SkillPackageDownload | null> {
    const response = await this.request(`/api/agent/skills/${slug}/${version}/package`);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      packageBase64: string;
      packageSha256?: string;
      packageSignature?: string;
    };
    return {
      packageBase64: data.packageBase64,
      packageSha256: data.packageSha256,
      packageSignature: data.packageSignature,
    };
  }
}

export interface SkillPackageDownload {
  packageBase64: string;
  packageSha256?: string;
  /** Hex-encoded Ed25519 signature over the raw tarball bytes */
  packageSignature?: string;
}
