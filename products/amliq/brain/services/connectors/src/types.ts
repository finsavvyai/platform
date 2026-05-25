/**
 * AMLIQ Brain — MCP Connector contracts.
 *
 * Implements Brain Month 2 conventions cross-agent mesh §1 (connector
 * interface) and §2 (tenant context). Every connector:
 *
 *   - emits `ComplianceDoc` records (frozen Week-2 shape, duplicated
 *     here to satisfy the no-`@finsavvyai/*` import rule for `products/*`);
 *   - accepts a `TenantContext` on every call and MUST scope upstream
 *     queries by `tenant_id` (release-blocking rule).
 *
 * SEARCH-UI consumes these contracts via DI. SAR-AGENT may consume too.
 *
 * License: Apache-2.0
 */

/**
 * Cross-agent ComplianceDoc shape (Week-2 §3). Duplicated structurally
 * from `oss/finsavvy-rag/src/types/compliance-doc.ts` to avoid a
 * cross-package import from `products/*` (round-2 rule). Field-for-field
 * identical; runtime guards in `_lib.ts` enforce the contract.
 */
export interface ComplianceDoc {
  readonly source: string;
  readonly jurisdiction: string;
  readonly doc_id: string;
  readonly title: string;
  readonly published_at: string;
  /** Lowercase hex SHA-256 of `body` (UTF-8). Exactly 64 chars. */
  readonly sha256: string;
  readonly body: string;
}

/**
 * Tenant context — propagated through every brain request (mesh §2).
 * MULTI-TENANT agent owns the canonical definition in
 * `services/api/src/tenant/types.ts`; this is a connector-local mirror.
 */
export interface TenantContext {
  readonly tenant_id: string;
  readonly actor_id: string;
  readonly roles: readonly string[];
}

/** Source key — matches `ComplianceDoc.source`. Connector-local v1 set. */
export type ConnectorSource = "slack" | "confluence" | "drive";

/**
 * Search-style query for a connector. Each connector translates these
 * fields into its native query language (Slack search.messages text,
 * Confluence CQL, Drive `q` param). `filters` is opaque — connectors
 * MAY accept extras but MUST silently ignore unknown keys.
 */
export interface ConnectorQuery {
  readonly text: string;
  readonly limit?: number;
  readonly cursor?: string;
  readonly filters?: Readonly<Record<string, string>>;
}

/** Lightweight list item — full body fetched lazily via `fetch(uri)`. */
export interface ConnectorListItem {
  readonly uri: string;
  readonly title: string;
  readonly snippet: string;
  readonly updated_at: string;
}

/** Paginated list result. `cursor` is null when there are no more pages. */
export interface ConnectorListResult {
  readonly items: readonly ConnectorListItem[];
  readonly cursor: string | null;
}

/** Unsubscribe handle returned by `watch()`. */
export type Unsubscribe = () => void;

/**
 * Connector interface — mesh §1. Every implementation is constructed
 * with its own HTTP client / SDK (DI), so this surface is transport-free
 * and trivially mockable.
 */
export interface McpConnector {
  readonly source: ConnectorSource;
  list(
    query: ConnectorQuery,
    ctx: TenantContext,
  ): Promise<ConnectorListResult>;
  fetch(uri: string, ctx: TenantContext): Promise<ComplianceDoc>;
  watch?(
    callback: (doc: ComplianceDoc) => void,
    ctx: TenantContext,
  ): Unsubscribe;
}

/**
 * Connector error codes. Stable strings — never free-form messages in
 * the `code` field (consumers branch on these).
 */
export type ConnectorErrorCode =
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "upstream_error"
  | "timeout"
  | "not_implemented"
  | "invalid_uri";

/** Thrown by every connector method on non-recoverable failures. */
export class ConnectorError extends Error {
  public readonly code: ConnectorErrorCode;
  public readonly source: ConnectorSource;
  public readonly status?: number;

  constructor(
    source: ConnectorSource,
    code: ConnectorErrorCode,
    message: string,
    status?: number,
  ) {
    super(`[${source}:${code}] ${message}`);
    this.name = "ConnectorError";
    this.source = source;
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}
