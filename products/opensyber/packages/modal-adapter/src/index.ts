export interface ModalAttestationPayload {
  instanceId: string;
  eventType: string;
  severity: 'info' | 'warning' | 'critical';
  details?: string;
  timestamp?: string;
}

export interface ModalAdapterClientOptions {
  baseUrl: string;
  apiToken: string;
  instanceId: string;
}

export class ModalAdapterClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly instanceId: string;

  constructor(options: ModalAdapterClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiToken = options.apiToken;
    this.instanceId = options.instanceId;
  }

  async reportAttestation(payload: Omit<ModalAttestationPayload, 'instanceId'>): Promise<Response> {
    return fetch(`${this.baseUrl}/api/security/instances/${this.instanceId}/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        eventType: payload.eventType,
        severity: payload.severity,
        details: payload.details ?? null,
        createdAt: payload.timestamp ?? new Date().toISOString(),
      }),
    });
  }
}

export function createModalAdapterClient(options: ModalAdapterClientOptions): ModalAdapterClient {
  return new ModalAdapterClient(options);
}

