import * as vscode from "vscode";

export interface LicenseInfo {
  valid: boolean;
  plan: string;
  features: string[];
}

export class LicenseClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async validate(key: string): Promise<LicenseInfo> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${this.baseUrl}/license/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ key }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`License validation failed: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as LicenseInfo;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Try to validate license; if worker is down / offline, fall back to cached result
   */
  async validateOrFallback(
    key: string,
    context: vscode.ExtensionContext
  ): Promise<LicenseInfo> {
    try {
      const result = await this.validate(key);
      await context.globalState.update("lf:license-cache", result);
      return result;
    } catch (err) {
      const cached = context.globalState.get<LicenseInfo>("lf:license-cache");
      if (cached) return cached;

      return {
        valid: false,
        plan: "free",
        features: []
      };
    }
  }
}