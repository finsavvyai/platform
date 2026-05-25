/**
 * Confluence Cloud MCP connector. REST v1 + v2 mix:
 *
 *   - list  → /wiki/rest/api/content/search?cql=...
 *   - fetch → /wiki/api/v2/pages/{id}?body-format=storage
 *
 * Tenant isolation: every CQL query is prefixed with
 * `label = "tenant-<id>"` so cross-tenant pages are excluded at the
 * Confluence query layer. Verified by `confluence-connector.test.ts`.
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
  type McpConnector,
  type TenantContext,
} from "../types.js";

export interface ConfluenceConnectorConfig {
  /** Absolute base URL, no trailing slash. E.g. `https://acme.atlassian.net`. */
  readonly baseUrl: string;
  /** Per-tenant API token resolver (email:token Basic auth payload). */
  readonly tokenForTenant: (tenantId: string) => string;
  /** Injected for tests; defaults to global fetch. */
  readonly httpFetch?: typeof fetch;
  /** Optional override; defaults to 10s. */
  readonly timeoutMs?: number;
}

interface ConfluenceSearchResult {
  readonly results: readonly {
    readonly id: string;
    readonly title: string;
    readonly space?: { readonly key: string };
    readonly version?: { readonly when: string };
    readonly excerpt?: string;
  }[];
  readonly _links?: { readonly next?: string };
}

interface ConfluencePage {
  readonly id: string;
  readonly title: string;
  readonly version?: { readonly createdAt?: string };
  readonly body?: { readonly storage?: { readonly value: string } };
}

export class ConfluenceConnector implements McpConnector {
  public readonly source = "confluence" as const;
  private readonly cfg: ConfluenceConnectorConfig;

  constructor(cfg: ConfluenceConnectorConfig) {
    this.cfg = cfg;
  }

  async list(
    query: ConnectorQuery,
    ctx: TenantContext,
  ): Promise<ConnectorListResult> {
    requireTenant(this.source, ctx);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const safeText = query.text.replace(/"/g, '\\"');
    const cql = `label = "tenant-${ctx.tenant_id}" AND text ~ "${safeText}"`;
    const url = new URL(`${this.cfg.baseUrl}/wiki/rest/api/content/search`);
    url.searchParams.set("cql", cql);
    url.searchParams.set("limit", String(limit));
    if (query.cursor) url.searchParams.set("cursor", query.cursor);
    const data = await this.callJson<ConfluenceSearchResult>(
      url.toString(),
      ctx.tenant_id,
    );
    return {
      items: data.results.map((r) => ({
        uri: `confluence://${r.space?.key ?? "unknown"}/${r.id}`,
        title: r.title,
        snippet: normalizeText(r.excerpt ?? "").slice(0, 240),
        updated_at: r.version?.when ?? "",
      })),
      cursor: data._links?.next ? extractCursor(data._links.next) : null,
    };
  }

  async fetch(uri: string, ctx: TenantContext): Promise<ComplianceDoc> {
    requireTenant(this.source, ctx);
    const parsed = parseConfluenceUri(uri);
    const url =
      `${this.cfg.baseUrl}/wiki/api/v2/pages/${encodeURIComponent(parsed.pageId)}` +
      `?body-format=storage`;
    const page = await this.callJson<ConfluencePage>(url, ctx.tenant_id);
    const body = normalizeText(page.body?.storage?.value ?? "");
    return {
      source: "confluence",
      jurisdiction: "internal",
      doc_id: formatDocId(this.source, [parsed.spaceKey, parsed.pageId]),
      title: page.title,
      published_at: page.version?.createdAt ?? "",
      sha256: sha256(body),
      body,
    };
  }

  private async callJson<T>(url: string, tenantId: string): Promise<T> {
    const token = this.cfg.tokenForTenant(tenantId);
    const res = await fetchWithTimeout(
      this.source,
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${token}`,
          Accept: "application/json",
        },
      },
      this.cfg.timeoutMs ?? 10_000,
      this.cfg.httpFetch ?? fetch,
    );
    mapHttpError(this.source, res);
    return (await res.json()) as T;
  }
}

/** Translate non-2xx Confluence/Drive responses into ConnectorError. */
export function mapHttpError(
  source: "confluence" | "drive",
  res: Response,
): void {
  if (res.ok) return;
  if (res.status === 401) {
    throw new ConnectorError(source, "unauthorized", "bad credentials", 401);
  }
  if (res.status === 403) {
    throw new ConnectorError(source, "forbidden", "no access", 403);
  }
  if (res.status === 404) {
    throw new ConnectorError(source, "not_found", "not found", 404);
  }
  if (res.status === 429) {
    throw new ConnectorError(source, "rate_limited", "throttled", 429);
  }
  throw new ConnectorError(
    source,
    "upstream_error",
    `http ${res.status}`,
    res.status,
  );
}

function parseConfluenceUri(uri: string): {
  spaceKey: string;
  pageId: string;
} {
  const m = /^confluence:\/\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!m || !m[1] || !m[2]) {
    throw new ConnectorError(
      "confluence",
      "invalid_uri",
      `bad confluence uri: ${uri}`,
    );
  }
  return { spaceKey: m[1], pageId: m[2] };
}

function extractCursor(nextLink: string): string | null {
  const m = /[?&]cursor=([^&]+)/.exec(nextLink);
  return m && m[1] ? decodeURIComponent(m[1]) : null;
}
