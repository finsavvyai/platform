import type { MythicStory, MythicModelOutput } from "./types";

export interface MythicBackendClientOptions {
  baseUrl?: string;
  workerUrl?: string;
  apiKey?: string;
}

export class MythicBackendClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(opts: MythicBackendClientOptions = {}) {
    const raw =
      opts.baseUrl ??
      opts.workerUrl ??
      "http://localhost:9999";

    this.baseUrl = raw.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
  }

  async generate(story: MythicStory): Promise<MythicModelOutput> {
    const res = await fetch(this.baseUrl + "/v1/mythic", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
      },
      body: JSON.stringify(story)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mythic backend error ${res.status}: ${text}`);
    }

    return (await res.json()) as MythicModelOutput;
  }
}