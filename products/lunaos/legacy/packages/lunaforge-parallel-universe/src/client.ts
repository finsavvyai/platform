import type { UniverseRequest, UniverseResponse } from "./types";

export interface UniverseClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export class UniverseClient {
  constructor(private opts: UniverseClientOptions) {}

  async translate(req: UniverseRequest): Promise<UniverseResponse> {
    const res = await fetch(this.opts.baseUrl + "/v1/universe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {})
      },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      throw new Error("Universe backend error " + res.status + ": " + (await res.text()));
    }
    return (await res.json()) as UniverseResponse;
  }
}
