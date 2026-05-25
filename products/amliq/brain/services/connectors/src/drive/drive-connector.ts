/**
 * Google Drive v3 MCP connector.
 *
 *   - list  → /drive/v3/files?q=...&pageToken=...
 *   - fetch → /drive/v3/files/{id}?alt=media   (binary blobs)
 *            /drive/v3/files/{id}/export       (Google-native docs)
 *
 * Tenant isolation: every Drive query is constrained with
 * `appProperties has { key='tenant_id' and value='<id>' }` so only files
 * tagged for the calling tenant are listable. Verified by
 * `drive-connector.test.ts`. (Production rollout requires every
 * tenant-owned upload to land with that appProperty set — enforced by
 * the upload pipeline, not this connector.)
 */
import { fetchWithTimeout, formatDocId, normalizeText, requireTenant, sha256 } from "../_lib.js";
import { mapHttpError } from "../confluence/confluence-connector.js";
import {
  ConnectorError,
  type ComplianceDoc,
  type ConnectorListResult,
  type ConnectorQuery,
  type McpConnector,
  type TenantContext,
} from "../types.js";

export interface DriveConnectorConfig {
  /** OAuth bearer token resolver per tenant. */
  readonly tokenForTenant: (tenantId: string) => string;
  readonly httpFetch?: typeof fetch;
  readonly timeoutMs?: number;
  /** Override for tests; defaults to googleapis.com. */
  readonly baseUrl?: string;
}

interface DriveFileMeta {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedTime?: string;
}

interface DriveListResponse {
  readonly files: readonly DriveFileMeta[];
  readonly nextPageToken?: string;
}

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/html",
  "application/json",
]);
const GOOGLE_DOC = "application/vnd.google-apps.document";
const PDF = "application/pdf";

export class DriveConnector implements McpConnector {
  public readonly source = "drive" as const;
  private readonly cfg: DriveConnectorConfig;
  private readonly baseUrl: string;

  constructor(cfg: DriveConnectorConfig) {
    this.cfg = cfg;
    this.baseUrl = cfg.baseUrl ?? "https://www.googleapis.com";
  }

  async list(
    query: ConnectorQuery,
    ctx: TenantContext,
  ): Promise<ConnectorListResult> {
    requireTenant(this.source, ctx);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const safeText = query.text.replace(/'/g, "\\'");
    const q =
      `appProperties has { key='tenant_id' and value='${ctx.tenant_id}' }` +
      ` and fullText contains '${safeText}'`;
    const url = new URL(`${this.baseUrl}/drive/v3/files`);
    url.searchParams.set("q", q);
    url.searchParams.set("pageSize", String(limit));
    url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime),nextPageToken");
    if (query.cursor) url.searchParams.set("pageToken", query.cursor);
    const data = await this.callJson<DriveListResponse>(
      url.toString(),
      ctx.tenant_id,
    );
    return {
      items: data.files.map((f) => ({
        uri: `drive://${f.id}`,
        title: f.name,
        snippet: f.mimeType,
        updated_at: f.modifiedTime ?? "",
      })),
      cursor: data.nextPageToken && data.nextPageToken.length > 0
        ? data.nextPageToken
        : null,
    };
  }

  async fetch(uri: string, ctx: TenantContext): Promise<ComplianceDoc> {
    requireTenant(this.source, ctx);
    const fileId = parseDriveUri(uri);
    const meta = await this.callJson<DriveFileMeta>(
      `${this.baseUrl}/drive/v3/files/${encodeURIComponent(fileId)}` +
        `?fields=id,name,mimeType,modifiedTime`,
      ctx.tenant_id,
    );
    const body = await this.extractBody(fileId, meta.mimeType, ctx.tenant_id);
    return {
      source: "drive",
      jurisdiction: "internal",
      doc_id: formatDocId(this.source, [fileId]),
      title: meta.name,
      published_at: meta.modifiedTime ?? "",
      sha256: sha256(body),
      body,
    };
  }

  private async extractBody(
    fileId: string,
    mime: string,
    tenantId: string,
  ): Promise<string> {
    if (mime === GOOGLE_DOC) {
      const text = await this.callText(
        `${this.baseUrl}/drive/v3/files/${encodeURIComponent(fileId)}/export` +
          `?mimeType=text/plain`,
        tenantId,
      );
      return normalizeText(text);
    }
    if (TEXT_MIMES.has(mime)) {
      const raw = await this.callText(
        `${this.baseUrl}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
        tenantId,
      );
      return normalizeText(raw);
    }
    if (mime === PDF) {
      // TODO(brain-month-3): wire a PDF text extractor. Skeleton returns
      // a non-throwing not_implemented signal so search-ui can surface
      // a UI affordance without crashing.
      throw new ConnectorError(
        this.source,
        "not_implemented",
        "pdf extraction pending",
      );
    }
    throw new ConnectorError(
      this.source,
      "not_implemented",
      `mime not supported: ${mime}`,
    );
  }

  private async callJson<T>(url: string, tenantId: string): Promise<T> {
    const res = await this.call(url, tenantId);
    return (await res.json()) as T;
  }

  private async callText(url: string, tenantId: string): Promise<string> {
    const res = await this.call(url, tenantId);
    return await res.text();
  }

  private async call(url: string, tenantId: string): Promise<Response> {
    const token = this.cfg.tokenForTenant(tenantId);
    const res = await fetchWithTimeout(
      this.source,
      url,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      },
      this.cfg.timeoutMs ?? 10_000,
      this.cfg.httpFetch ?? fetch,
    );
    mapHttpError(this.source, res);
    return res;
  }
}

function parseDriveUri(uri: string): string {
  const m = /^drive:\/\/([^/]+)$/.exec(uri);
  if (!m || !m[1]) {
    throw new ConnectorError("drive", "invalid_uri", `bad drive uri: ${uri}`);
  }
  return m[1];
}
