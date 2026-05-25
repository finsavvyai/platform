/**
 * Internal helpers for the Teams connector. Kept in a separate module so
 * `teams-connector.ts` stays under the 200-line cap and the connector
 * file reads as a single transport-shaped object (no helper noise).
 */
import { normalizeText } from "../_lib.js";
import { ConnectorError, type ConnectorSource } from "../types.js";
import { TeamsRateLimitedError } from "./teams-rate-limited-error.js";

const TEAMS: ConnectorSource = "teams" as unknown as ConnectorSource;

export interface TeamsSearchHit {
  readonly hitId?: string;
  readonly resource?: {
    readonly id?: string;
    readonly body?: { readonly content?: string };
    readonly from?: { readonly user?: { readonly displayName?: string } };
    readonly lastModifiedDateTime?: string;
    readonly channelIdentity?: {
      readonly teamId?: string;
      readonly channelId?: string;
    };
  };
}

export interface TeamsSearchResponse {
  readonly value: readonly {
    readonly hitsContainers: readonly {
      readonly hits?: readonly TeamsSearchHit[];
      readonly moreResultsAvailable?: boolean;
      readonly total?: number;
    }[];
  }[];
}

export interface TeamsMessage {
  readonly id: string;
  readonly subject?: string | null;
  readonly body?: { readonly content?: string };
  readonly from?: { readonly user?: { readonly displayName?: string } };
  readonly lastModifiedDateTime?: string;
  readonly channelIdentity?: {
    readonly teamId?: string;
    readonly channelId?: string;
  };
}

/** Translate non-2xx Graph responses into a `ConnectorError`. */
export function mapTeamsHttpError(res: Response): void {
  if (res.ok) return;
  if (res.status === 401) {
    throw new ConnectorError(TEAMS, "unauthorized", "bad credentials", 401);
  }
  if (res.status === 403) {
    throw new ConnectorError(TEAMS, "forbidden", "no access", 403);
  }
  if (res.status === 404) {
    throw new ConnectorError(TEAMS, "not_found", "not found", 404);
  }
  if (res.status === 429) {
    const h = res.headers.get("Retry-After");
    const retry = h && /^\d+$/.test(h) ? Number.parseInt(h, 10) : undefined;
    throw new TeamsRateLimitedError("throttled", retry);
  }
  throw new ConnectorError(TEAMS, "upstream_error", `http ${res.status}`, res.status);
}

export function hitToUri(h: TeamsSearchHit, fallbackTeamId: string): string {
  const teamId = h.resource?.channelIdentity?.teamId ?? fallbackTeamId;
  const channelId = h.resource?.channelIdentity?.channelId ?? "unknown";
  const messageId = h.resource?.id ?? h.hitId ?? "unknown";
  return `teams:${teamId}:${channelId}:${messageId}`;
}

export function hitToTitle(h: TeamsSearchHit): string {
  const from = h.resource?.from?.user?.displayName;
  if (from && from.length > 0) return from;
  const text = normalizeText(h.resource?.body?.content ?? "");
  return text.slice(0, 80) || "teams message";
}

export function parseTeamsUri(uri: string): {
  teamId: string;
  channelId: string;
  messageId: string;
} {
  // Expect: teams:<teamId>:<channelId>:<messageId>
  const m = /^teams:([^:]+):([^:]+):([^:]+)$/.exec(uri);
  if (!m || !m[1] || !m[2] || !m[3]) {
    throw new ConnectorError(TEAMS, "invalid_uri", `bad teams uri: ${uri}`);
  }
  return { teamId: m[1], channelId: m[2], messageId: m[3] };
}
