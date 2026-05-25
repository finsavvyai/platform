// ServiceNow Change Management adapter — closes ENTERPRISE_ROADMAP.md P1 #12.
//
// Opens/closes CHG tickets on deploys so regulated customers get an audit
// trail in their existing change system. Two auth modes:
//   - Basic: username/password (okay for dev, bad in production)
//   - OAuth: client_credentials (recommended; ServiceNow OAuth 2.0)
//
// API: /api/now/table/change_request (ServiceNow Table API).
// Only the fields every customer asks for are exposed; freeform extras
// flow through customFields so integrators don't have to fork.

export interface ServiceNowConfig {
  instance: string;
  user?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  defaultAssignmentGroup?: string;
}

export interface ChangeTicketInput {
  shortDescription: string;
  description: string;
  startDate?: string;
  endDate?: string;
  riskLevel?: "low" | "moderate" | "high";
  assignmentGroup?: string;
  customFields?: Record<string, unknown>;
}

export interface ChangeTicket {
  sysId: string;
  number: string;
  state: string;
  url: string;
}

export class ServiceNowClient {
  private config: ServiceNowConfig;
  private cachedToken?: string;
  private tokenExpiresAt = 0;

  constructor(config: ServiceNowConfig) {
    if (!config.instance) throw new Error("servicenow: instance required");
    if (!config.user && !config.clientId) {
      throw new Error("servicenow: basic or oauth credentials required");
    }
    this.config = { ...config, instance: config.instance.replace(/\/$/, "") };
  }

  async createChange(input: ChangeTicketInput): Promise<ChangeTicket> {
    const body = {
      short_description: input.shortDescription,
      description: input.description,
      start_date: input.startDate,
      end_date: input.endDate,
      risk: input.riskLevel ?? "moderate",
      assignment_group: input.assignmentGroup ?? this.config.defaultAssignmentGroup,
      ...(input.customFields ?? {}),
    };
    const res = await this.apiFetch("/api/now/table/change_request", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`servicenow: create CHG failed: HTTP ${res.status}`);
    const { result } = (await res.json()) as { result: Record<string, string> };
    return {
      sysId: result.sys_id,
      number: result.number,
      state: result.state,
      url: `${this.config.instance}/nav_to.do?uri=change_request.do?sys_id=${result.sys_id}`,
    };
  }

  async closeChange(sysId: string, closeCode: "successful" | "unsuccessful", notes: string): Promise<void> {
    const res = await this.apiFetch(`/api/now/table/change_request/${sysId}`, {
      method: "PATCH",
      body: JSON.stringify({ state: "closed", close_code: closeCode, close_notes: notes }),
    });
    if (!res.ok) throw new Error(`servicenow: close CHG failed: HTTP ${res.status}`);
  }

  private async apiFetch(path: string, init: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (this.config.clientId) {
      headers.authorization = `Bearer ${await this.ensureOAuthToken()}`;
    } else {
      const creds = btoa(`${this.config.user}:${this.config.password}`);
      headers.authorization = `Basic ${creds}`;
    }
    return fetch(`${this.config.instance}${path}`, { ...init, headers });
  }

  private async ensureOAuthToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt - 30_000) return this.cachedToken;
    const res = await fetch(`${this.config.instance}/oauth_token.do`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId!,
        client_secret: this.config.clientSecret!,
      }),
    });
    if (!res.ok) throw new Error(`servicenow: oauth failed: HTTP ${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.cachedToken = body.access_token;
    this.tokenExpiresAt = now + body.expires_in * 1000;
    return this.cachedToken;
  }
}
