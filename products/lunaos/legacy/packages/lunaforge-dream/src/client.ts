import type { DreamIntent, DreamRunSummary } from "./types";

export interface DreamClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export class DreamClient {
  constructor(private opts: DreamClientOptions) { }

  async schedule(intent: DreamIntent): Promise<DreamRunSummary> {
    const res = await fetch(this.opts.baseUrl + "/v1/dream/schedule", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {})
      },
      body: JSON.stringify({ intent })
    });
    if (!res.ok) {
      throw new Error("Dream schedule error " + res.status + ": " + (await res.text()));
    }
    return (await res.json()) as DreamRunSummary;
  }

  async getStatus(id: string): Promise<DreamRunSummary> {
    const res = await fetch(this.opts.baseUrl + "/v1/dream/status?id=" + encodeURIComponent(id), {
      method: "GET",
      headers: {
        ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {})
      }
    });
    if (!res.ok) {
      throw new Error("Dream status error " + res.status + ": " + (await res.text()));
    }
    return (await res.json()) as DreamRunSummary;
  }

  async listRecent(): Promise<DreamRunSummary[]> {
    const res = await fetch(this.opts.baseUrl + "/v1/dream/recent", {
      method: "GET",
      headers: {
        ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {})
      }
    });
    if (!res.ok) {
      throw new Error("Dream recent error " + res.status + ": " + (await res.text()));
    }
    return (await res.json()) as DreamRunSummary[];
  }

  async waitForCompletion(id: string, intervalMs = 2000, timeoutMs = 60000): Promise<DreamRunSummary> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await this.getStatus(id);
      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error(`Dream job ${id} timed out after ${timeoutMs}ms`);
  }
}
