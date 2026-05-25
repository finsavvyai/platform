/**
 * Jira Cloud MCP connector. Atlassian REST API v3:
 *
 *   - list  → /rest/api/3/search?jql=...&fields=summary,description,labels,project
 *   - fetch → /rest/api/3/issue/{key}
 *
 * Tenant isolation: every JQL search is ANDed with
 * `labels in (tenant-<id>)` so cross-tenant issues are excluded at the
 * Jira query layer. Verified by `jira-connector.test.ts`. Requires
 * upstream-side discipline: every tenant-scoped issue MUST carry that
 * label — enforced by the import pipeline, not this connector.
 *
 * Auth: HTTP Basic (Atlassian Cloud `email:apiToken` — pass the base64
 * value pre-encoded) OR Bearer (OAuth 2.0 Cloud Token). Switch via
 * `JiraConnectorConfig.authMode`. Per-tenant tokens are resolved via DI;
 * this module never touches `process.env`.
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
import { JiraRateLimitedError } from "./jira-rate-limited-error.js";

/** Local widened source key — `ConnectorSource` is closed in `types.ts`. */
const JIRA: ConnectorSource = "jira" as unknown as ConnectorSource;

export type JiraAuthMode = "basic" | "bearer";

export interface JiraConnectorConfig {
  /** Absolute base URL, no trailing slash. E.g. `https://acme.atlassian.net`. */
  readonly baseUrl: string;
  /** Per-tenant token resolver. Basic → base64(`email:apiToken`); Bearer → JWT. */
  readonly tokenForTenant: (tenantId: string) => string;
  /** Selects the `Authorization` header scheme. */
  readonly authMode: JiraAuthMode;
  readonly httpFetch?: typeof fetch;
  readonly timeoutMs?: number;
}

interface JiraIssueSummary {
  readonly id: string;
  readonly key: string;
  readonly fields?: {
    readonly summary?: string;
    readonly description?: string;
    readonly updated?: string;
    readonly labels?: readonly string[];
    readonly project?: { readonly key: string };
  };
}

interface JiraSearchResponse {
  readonly issues: readonly JiraIssueSummary[];
  readonly startAt: number;
  readonly maxResults: number;
  readonly total: number;
}

export class JiraConnector implements McpConnector {
  public readonly source = JIRA;
  private readonly cfg: JiraConnectorConfig;

  constructor(cfg: JiraConnectorConfig) {
    this.cfg = cfg;
  }

  async list(
    query: ConnectorQuery,
    ctx: TenantContext,
  ): Promise<ConnectorListResult> {
    requireTenant(JIRA, ctx);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const safeText = query.text.replace(/"/g, '\\"');
    const userJql = safeText.length > 0 ? `text ~ "${safeText}" AND ` : "";
    const jql = `${userJql}labels in (tenant-${ctx.tenant_id})`;
    const url = new URL(`${this.cfg.baseUrl}/rest/api/3/search`);
    url.searchParams.set("jql", jql);
    url.searchParams.set("maxResults", String(limit));
    url.searchParams.set("fields", "summary,description,labels,project,updated");
    if (query.cursor) url.searchParams.set("startAt", query.cursor);
    const data = await this.callJson<JiraSearchResponse>(
      url.toString(),
      ctx.tenant_id,
    );
    const nextStart = data.startAt + data.issues.length;
    return {
      items: data.issues.map((i) => ({
        uri: `jira:${i.fields?.project?.key ?? "UNKNOWN"}:${i.key}`,
        title: i.fields?.summary ?? i.key,
        snippet: normalizeText(i.fields?.description ?? "").slice(0, 240),
        updated_at: i.fields?.updated ?? "",
      })),
      cursor: nextStart < data.total ? String(nextStart) : null,
    };
  }

  async fetch(uri: string, ctx: TenantContext): Promise<ComplianceDoc> {
    requireTenant(JIRA, ctx);
    const parsed = parseJiraUri(uri);
    const url = `${this.cfg.baseUrl}/rest/api/3/issue/${encodeURIComponent(parsed.issueKey)}`;
    const issue = await this.callJson<JiraIssueSummary>(url, ctx.tenant_id);
    const summary = issue.fields?.summary ?? "";
    const description = normalizeText(issue.fields?.description ?? "");
    const body = description.length > 0
      ? `${summary}\n\n${description}`
      : summary;
    return {
      source: "jira",
      jurisdiction: "internal",
      doc_id: formatDocId(JIRA, [parsed.projectKey, parsed.issueKey]),
      title: summary.length > 0 ? summary : parsed.issueKey,
      published_at: issue.fields?.updated ?? "",
      sha256: sha256(body),
      body,
    };
  }

  private async callJson<T>(url: string, tenantId: string): Promise<T> {
    const token = this.cfg.tokenForTenant(tenantId);
    const scheme = this.cfg.authMode === "basic" ? "Basic" : "Bearer";
    const res = await fetchWithTimeout(
      JIRA,
      url,
      {
        method: "GET",
        headers: {
          Authorization: `${scheme} ${token}`,
          Accept: "application/json",
        },
      },
      this.cfg.timeoutMs ?? 10_000,
      this.cfg.httpFetch ?? fetch,
    );
    mapJiraHttpError(res);
    return (await res.json()) as T;
  }
}

/** Translate non-2xx Jira responses into `ConnectorError`. */
export function mapJiraHttpError(res: Response): void {
  if (res.ok) return;
  if (res.status === 401) {
    throw new ConnectorError(JIRA, "unauthorized", "bad credentials", 401);
  }
  if (res.status === 403) {
    throw new ConnectorError(JIRA, "forbidden", "no access", 403);
  }
  if (res.status === 404) {
    throw new ConnectorError(JIRA, "not_found", "not found", 404);
  }
  if (res.status === 429) {
    const retryHeader = res.headers.get("Retry-After");
    const retry = retryHeader && /^\d+$/.test(retryHeader)
      ? Number.parseInt(retryHeader, 10)
      : undefined;
    throw new JiraRateLimitedError("throttled", retry);
  }
  throw new ConnectorError(JIRA, "upstream_error", `http ${res.status}`, res.status);
}

function parseJiraUri(uri: string): { projectKey: string; issueKey: string } {
  // Expect: jira:<project_key>:<issue_key>  e.g. jira:AML:AML-42
  // Mirrors doc_id format from `formatDocId('jira', [project, issue])`.
  const m = /^jira:([^:]+):([^:]+)$/.exec(uri);
  if (!m || !m[1] || !m[2]) {
    throw new ConnectorError(JIRA, "invalid_uri", `bad jira uri: ${uri}`);
  }
  return { projectKey: m[1], issueKey: m[2] };
}
