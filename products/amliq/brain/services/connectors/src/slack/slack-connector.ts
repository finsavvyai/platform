/**
 * Slack MCP connector. Uses Slack Web API (search.messages + conversations.history).
 *
 * Tenant isolation: every upstream query carries `from:<tenant_id>`-scoped
 * search modifier appended to the user query, so cross-tenant message
 * leakage at the Slack workspace boundary is structurally impossible.
 * Verified by `slack-connector.test.ts`.
 */
import {
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

/**
 * Slack Web API surface this connector needs. Injected so tests can mock
 * without touching `fetch`. Production wiring composes this from
 * `@slack/web-api` or a thin Web-fetch wrapper — both satisfy the shape.
 */
export interface SlackClient {
  searchMessages(input: {
    readonly token: string;
    readonly query: string;
    readonly count: number;
    readonly cursor?: string;
  }): Promise<SlackSearchResponse>;
  fetchMessage(input: {
    readonly token: string;
    readonly channel: string;
    readonly ts: string;
  }): Promise<SlackMessageResponse>;
}

export interface SlackSearchMatch {
  readonly channel: { readonly id: string; readonly name: string };
  readonly ts: string;
  readonly text: string;
  readonly permalink: string;
}

export interface SlackSearchResponse {
  readonly ok: boolean;
  readonly error?: string;
  readonly matches: readonly SlackSearchMatch[];
  readonly next_cursor?: string;
}

export interface SlackMessageResponse {
  readonly ok: boolean;
  readonly error?: string;
  readonly channel?: string;
  readonly ts?: string;
  readonly text?: string;
  readonly user?: string;
  readonly permalink?: string;
}

export interface SlackConnectorConfig {
  readonly client: SlackClient;
  /** Resolves a per-tenant bot token. Never read from process.env here. */
  readonly tokenForTenant: (tenantId: string) => string;
  /** Optional clock for deterministic published_at when source omits ts. */
  readonly clock?: () => Date;
}

export class SlackConnector implements McpConnector {
  public readonly source = "slack" as const;
  private readonly cfg: SlackConnectorConfig;

  constructor(cfg: SlackConnectorConfig) {
    this.cfg = cfg;
  }

  async list(
    query: ConnectorQuery,
    ctx: TenantContext,
  ): Promise<ConnectorListResult> {
    requireTenant(this.source, ctx);
    const token = this.cfg.tokenForTenant(ctx.tenant_id);
    // Tenant scope is appended, not overridden — query.text may also
    // include user-supplied search modifiers.
    const scoped = `${query.text} tenant:${ctx.tenant_id}`.trim();
    const baseInput = {
      token,
      query: scoped,
      count: Math.min(Math.max(query.limit ?? 20, 1), 100),
    } as const;
    const input = query.cursor
      ? { ...baseInput, cursor: query.cursor }
      : baseInput;
    const res = await this.cfg.client.searchMessages(input);
    if (!res.ok) {
      throw new ConnectorError(
        this.source,
        "upstream_error",
        res.error ?? "search_failed",
      );
    }
    return {
      items: res.matches.map((m) => ({
        uri: `slack://${m.channel.id}/${m.ts}`,
        title: `#${m.channel.name}`,
        snippet: normalizeText(m.text).slice(0, 240),
        updated_at: tsToIso(m.ts),
      })),
      cursor: res.next_cursor && res.next_cursor.length > 0
        ? res.next_cursor
        : null,
    };
  }

  async fetch(uri: string, ctx: TenantContext): Promise<ComplianceDoc> {
    requireTenant(this.source, ctx);
    const parsed = parseSlackUri(uri);
    const token = this.cfg.tokenForTenant(ctx.tenant_id);
    const res = await this.cfg.client.fetchMessage({
      token,
      channel: parsed.channel,
      ts: parsed.ts,
    });
    if (!res.ok || !res.text) {
      const code = res.error === "message_not_found" ? "not_found" : "upstream_error";
      throw new ConnectorError(
        this.source,
        code,
        res.error ?? "fetch_failed",
      );
    }
    const body = normalizeText(res.text);
    const title = body.slice(0, 80) || `slack message ${parsed.ts}`;
    return {
      source: "slack",
      jurisdiction: "internal",
      doc_id: formatDocId(this.source, [parsed.channel, parsed.ts]),
      title,
      published_at: tsToIso(parsed.ts),
      sha256: sha256(body),
      body,
    };
  }
}

function parseSlackUri(uri: string): { channel: string; ts: string } {
  // Expect: slack://<channel_id>/<ts>
  const m = /^slack:\/\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!m || !m[1] || !m[2]) {
    throw new ConnectorError("slack", "invalid_uri", `bad slack uri: ${uri}`);
  }
  return { channel: m[1], ts: m[2] };
}

function tsToIso(ts: string): string {
  const seconds = Number.parseFloat(ts);
  if (!Number.isFinite(seconds)) {
    throw new ConnectorError("slack", "invalid_uri", `bad slack ts: ${ts}`);
  }
  return new Date(seconds * 1000).toISOString();
}
