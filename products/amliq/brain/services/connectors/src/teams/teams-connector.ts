/**
 * Microsoft Teams MCP connector. Microsoft Graph v1.0:
 *
 *   - list  → POST /v1.0/search/query  (entityTypes: ['chatMessage'])
 *   - fetch → GET  /v1.0/teams/{team}/channels/{channel}/messages/{message}
 *
 * Tenant isolation: every KQL query is ANDed with
 * `channelIdentity/teamId:<teamIdForTenant(tenantId)>` so the upstream
 * Graph search is structurally constrained to the tenant's team. The
 * tenant→team mapping is supplied via DI (`teamIdForTenant`) — this
 * module never reads `process.env` and never assumes a global team.
 * Verified by `teams-connector.test.ts`.
 *
 * Auth: OAuth 2.0 Bearer via DI'd `tokenForTenant(tenantId)`. Helper
 * shapes + http-error mapping + uri parsing live in `./teams-internal.ts`
 * so this file stays under the 200-line cap.
 */
import {
  fetchWithTimeout,
  formatDocId,
  normalizeText,
  requireTenant,
  sha256,
} from "../_lib.js";
import {
  ConnectorError,
  type ComplianceDoc,
  type ConnectorListResult,
  type ConnectorQuery,
  type ConnectorSource,
  type McpConnector,
  type TenantContext,
} from "../types.js";
import {
  hitToTitle,
  hitToUri,
  mapTeamsHttpError,
  parseTeamsUri,
  type TeamsMessage,
  type TeamsSearchResponse,
} from "./teams-internal.js";

const TEAMS: ConnectorSource = "teams" as unknown as ConnectorSource;

export interface TeamsConnectorConfig {
  /** Graph base URL. Defaults to `https://graph.microsoft.com`. */
  readonly baseUrl?: string;
  /** Per-tenant OAuth bearer resolver. */
  readonly tokenForTenant: (tenantId: string) => string;
  /** Tenant → Teams `teamId` resolver. Release-blocking for isolation. */
  readonly teamIdForTenant: (tenantId: string) => string;
  readonly httpFetch?: typeof fetch;
  readonly timeoutMs?: number;
}

export class TeamsConnector implements McpConnector {
  public readonly source = TEAMS;
  private readonly cfg: TeamsConnectorConfig;
  private readonly baseUrl: string;

  constructor(cfg: TeamsConnectorConfig) {
    this.cfg = cfg;
    this.baseUrl = cfg.baseUrl ?? "https://graph.microsoft.com";
  }

  async list(
    query: ConnectorQuery,
    ctx: TenantContext,
  ): Promise<ConnectorListResult> {
    requireTenant(TEAMS, ctx);
    const teamId = this.cfg.teamIdForTenant(ctx.tenant_id);
    if (!teamId) {
      throw new ConnectorError(
        TEAMS,
        "unauthorized",
        "no team mapping for tenant",
      );
    }
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const safeText = query.text.replace(/"/g, '\\"');
    const userKql = safeText.length > 0 ? `"${safeText}" AND ` : "";
    const kql = `${userKql}(channelIdentity/teamId:${teamId})`;
    const from = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
    const body = JSON.stringify({
      requests: [
        {
          entityTypes: ["chatMessage"],
          query: { queryString: kql },
          from,
          size: limit,
        },
      ],
    });
    const data = await this.callJson<TeamsSearchResponse>(
      `${this.baseUrl}/v1.0/search/query`,
      ctx.tenant_id,
      { method: "POST", body },
    );
    const hits = data.value[0]?.hitsContainers[0]?.hits ?? [];
    const more = data.value[0]?.hitsContainers[0]?.moreResultsAvailable === true;
    return {
      items: hits.map((h) => ({
        uri: hitToUri(h, teamId),
        title: hitToTitle(h),
        snippet: normalizeText(h.resource?.body?.content ?? "").slice(0, 240),
        updated_at: h.resource?.lastModifiedDateTime ?? "",
      })),
      cursor: more ? String(from + hits.length) : null,
    };
  }

  async fetch(uri: string, ctx: TenantContext): Promise<ComplianceDoc> {
    requireTenant(TEAMS, ctx);
    const parts = parseTeamsUri(uri);
    const url =
      `${this.baseUrl}/v1.0/teams/${encodeURIComponent(parts.teamId)}` +
      `/channels/${encodeURIComponent(parts.channelId)}` +
      `/messages/${encodeURIComponent(parts.messageId)}`;
    const msg = await this.callJson<TeamsMessage>(url, ctx.tenant_id, {
      method: "GET",
    });
    const body = normalizeText(msg.body?.content ?? "");
    const title = msg.subject && msg.subject.length > 0
      ? msg.subject
      : body.slice(0, 80) || `teams message ${parts.messageId}`;
    return {
      source: "teams",
      jurisdiction: "internal",
      doc_id: formatDocId(TEAMS, [parts.teamId, parts.channelId, parts.messageId]),
      title,
      published_at: msg.lastModifiedDateTime ?? "",
      sha256: sha256(body),
      body,
    };
  }

  private async callJson<T>(
    url: string,
    tenantId: string,
    init: { readonly method: "GET" | "POST"; readonly body?: string },
  ): Promise<T> {
    const token = this.cfg.tokenForTenant(tenantId);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    if (init.method === "POST") headers["Content-Type"] = "application/json";
    const res = await fetchWithTimeout(
      TEAMS,
      url,
      init.body !== undefined
        ? { method: init.method, headers, body: init.body }
        : { method: init.method, headers },
      this.cfg.timeoutMs ?? 10_000,
      this.cfg.httpFetch ?? fetch,
    );
    mapTeamsHttpError(res);
    return (await res.json()) as T;
  }
}
