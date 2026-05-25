export interface FlyAttestationEvent {
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  details?: string;
  createdAt?: string;
}

export interface FlyAdapterOptions {
  baseUrl: string;
  apiToken: string;
  instanceId: string;
  appName?: string;
}

export class FlyAdapterClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly instanceId: string;
  private readonly appName: string;

  constructor(options: FlyAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiToken = options.apiToken;
    this.instanceId = options.instanceId;
    this.appName = options.appName ?? 'fly-app';
  }

  async report(event: FlyAttestationEvent): Promise<Response> {
    const details = event.details
      ? `[${this.appName}] ${event.details}`
      : `[${this.appName}] runtime event`;

    return fetch(`${this.baseUrl}/api/security/instances/${this.instanceId}/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        eventType: event.eventType,
        severity: event.severity,
        details,
        createdAt: event.createdAt ?? new Date().toISOString(),
      }),
    });
  }
}

export function createFlyAdapterClient(options: FlyAdapterOptions): FlyAdapterClient {
  return new FlyAdapterClient(options);
}

