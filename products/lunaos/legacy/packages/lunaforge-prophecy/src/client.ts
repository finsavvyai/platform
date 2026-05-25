import type { ProphecyClientOptions, ProphecyInput, ProphecyResult } from "./types";

export class ProphecyClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(opts: ProphecyClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.apiKey = opts.apiKey;
  }

  async generate(input: ProphecyInput): Promise<ProphecyResult> {
    const res = await fetch(`${this.baseUrl}/prophecy/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify(input)
    });

    if (!res.ok) {
      throw new Error(`Prophecy worker error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as ProphecyResult;
    return data;
  }
}