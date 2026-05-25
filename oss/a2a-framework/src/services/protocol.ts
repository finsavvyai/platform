import { v4 as uuidv4 } from 'uuid';

export interface Handshake {
  agentId: string;
  version: string;
  capabilities: string[];
  timestamp: number;
}

export interface RequestEnvelope {
  requestId: string;
  method: string;
  params: Record<string, unknown>;
  timeout?: number;
}

export interface ResponseEnvelope {
  requestId: string;
  status: 'success' | 'error';
  data?: unknown;
  error?: string;
}

export class A2AProtocol {
  private version = '1.0.0';
  private requestTimeouts: Map<string, NodeJS.Timeout> = new Map();

  public createHandshake(
    agentId: string,
    capabilities: string[]
  ): Handshake {
    if (!agentId) throw new Error('agentId is required');
    return {
      agentId,
      version: this.version,
      capabilities,
      timestamp: Date.now(),
    };
  }

  public validateHandshake(hs: Handshake): boolean {
    return !!(hs.agentId && hs.version && Array.isArray(hs.capabilities));
  }

  public createRequest(
    method: string,
    params: Record<string, unknown> = {},
    timeout: number = 30000
  ): RequestEnvelope {
    if (!method) throw new Error('method is required');
    return {
      requestId: uuidv4(),
      method,
      params,
      timeout,
    };
  }

  public createResponse(
    requestId: string,
    status: 'success' | 'error',
    data?: unknown,
    error?: string
  ): ResponseEnvelope {
    if (!requestId) throw new Error('requestId is required');
    return { requestId, status, data, error };
  }

  public validateRequest(req: RequestEnvelope): boolean {
    return !!(req.requestId && req.method);
  }

  public validateResponse(res: ResponseEnvelope): boolean {
    return !!(res.requestId && res.status);
  }

  public setRequestTimeout(
    requestId: string,
    timeout: number,
    onTimeout: () => void
  ): void {
    const timer = setTimeout(() => {
      this.requestTimeouts.delete(requestId);
      onTimeout();
    }, timeout);
    this.requestTimeouts.set(requestId, timer);
  }

  public clearRequestTimeout(requestId: string): void {
    const timer = this.requestTimeouts.get(requestId);
    if (timer) {
      clearTimeout(timer);
      this.requestTimeouts.delete(requestId);
    }
  }

  public getVersion(): string {
    return this.version;
  }
}
