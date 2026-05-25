import type { AgentPlan } from "./workerTypes";

export interface WorkerClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export class WorkerClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(opts: WorkerClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
  }
  async call<T = any>(method: string, payload?: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {})
    });

    if (!res.ok) {
      throw new Error(`Worker error: ${res.status} ${await res.text()}`);
    }

    return (await res.json()) as T;
  }
  private async request(path: string, body: any): Promise<any> {
    const res = await fetch(this.baseUrl + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Worker error ${res.status}: ${text}`);
    }

    return res.json();
  }

  async plan(target: string, summary?: string): Promise<AgentPlan> {
    const data = await this.request("/v1/plan", { target, summary });
    return data.plan as AgentPlan;
  }

  async memoryGet(key: string): Promise<any | null> {
    const data = await this.request("/v1/memory/get", { key });
    return data.memory ?? null;
  }

  async memoryPut(key: string, value: unknown, scope = "workspace"): Promise<any> {
    const data = await this.request("/v1/memory/put", { key, value, scope });
    return data.memory;
  }

  async licenseValidate(key: string): Promise<boolean> {
    const data = await this.request("/v1/license/validate", { key });
    return !!data.valid;
  }

  async ping(): Promise<boolean> {
    try {
      await this.request("/health", {}); // Assuming /health endpoint exists or any other endpoint
      return true;
    } catch {
      return false;
    }
  }
}
