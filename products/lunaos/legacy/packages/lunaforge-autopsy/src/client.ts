import type { AutopsyInput, AutopsyReport } from "./types";

export interface AutopsyClientOptions {
  baseUrl: string;
  apiKey?: string;
}

export class AutopsyClient {
  constructor(private opts: AutopsyClientOptions) {}

  async analyze(input: AutopsyInput): Promise<AutopsyReport> {
    const res = await fetch(this.opts.baseUrl + "/v1/autopsy", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {})
      },
      body: JSON.stringify(input)
    });
    if (!res.ok) {
      throw new Error("Autopsy backend error " + res.status + ": " + (await res.text()));
    }
    return (await res.json()) as AutopsyReport;
  }
}
