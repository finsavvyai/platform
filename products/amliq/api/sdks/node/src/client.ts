import type {
  AMLIQConfig,
  ScreenRequest,
  ScreenResponse,
  FastScreenResult,
  AlertsResponse,
  ResolveAlertRequest,
} from "./types.js";
import { AMLIQError, AuthError, RateLimitError } from "./errors.js";

/** AMLIQ API client for Node.js/TypeScript. */
export class AMLIQClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(config: AMLIQConfig) {
    this.baseUrl = (config.baseUrl ?? "https://api.amliq.io/api/v1").replace(/\/$/, "");
    this.headers = {
      "X-API-Key": config.apiKey,
      "Content-Type": "application/json",
    };
    this.timeout = config.timeout ?? 30000;
  }

  /** Screen a single entity against sanctions lists. */
  async screen(request: ScreenRequest): Promise<ScreenResponse> {
    return this.post<ScreenResponse>("/screen", request);
  }

  /** Fast sub-10ms payment screening (Exact + Fuzzy only). */
  async screenFast(name: string): Promise<FastScreenResult> {
    return this.post<FastScreenResult>("/screen/fast", { name });
  }

  /** List all alerts for the authenticated tenant. */
  async listAlerts(): Promise<AlertsResponse> {
    return this.get<AlertsResponse>("/alerts");
  }

  /** Resolve an alert with a disposition. */
  async resolveAlert(alertId: string, request: ResolveAlertRequest): Promise<void> {
    await this.put(`/alerts/${alertId}/resolve`, request);
  }

  /** Get tenant screening configuration. */
  async getConfig(): Promise<Record<string, unknown>> {
    return this.get("/config");
  }

  /** Check billing system status. */
  async billingHealth(): Promise<Record<string, unknown>> {
    return this.get("/billing/health");
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const resp = await fetch(this.baseUrl + path, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (resp.status === 401) throw new AuthError();
      if (resp.status === 429) throw new RateLimitError();
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({})) as Record<string, string>;
        throw new AMLIQError(err.message ?? `HTTP ${resp.status}`, err.code, resp.status);
      }
      return (await resp.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
