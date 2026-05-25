/**
 * Shared connector helpers.
 *
 * Pure utilities — no module-level state. Each function is unit-tested in
 * `_lib.test.ts`. Anything that touches an external API belongs in a
 * connector module, not here.
 */
import { createHash } from "node:crypto";
import { ConnectorError, type ConnectorSource } from "./types.js";

/** Lowercase hex SHA-256 of a UTF-8 string. Always 64 chars. */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Strip HTML/script/style markup, collapse whitespace. Keeps original
 * casing — callers lowercase only at scoring time so original tokens are
 * preserved for the body field of `ComplianceDoc`.
 *
 * Decodes the five named XML entities + numeric refs. Sufficient for
 * Slack message blocks, Confluence storage-format HTML, and Drive plain
 * exports. Anything richer goes through a real HTML parser at the caller.
 */
export function normalizeText(raw: string): string {
  if (raw.length === 0) return "";
  // Remove CDATA wrappers but keep their inner text.
  let s = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Strip <script>/<style> with contents.
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ");
  // Strip HTML comments.
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Strip any remaining tags.
  s = s.replace(/<[^>]+>/g, " ");
  // Decode entities.
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d: string) =>
      String.fromCodePoint(Number.parseInt(d, 10)),
    )
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) =>
      String.fromCodePoint(Number.parseInt(h, 16)),
    );
  // Collapse whitespace.
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Stable `doc_id` builder. Parts are joined with `:` and each part is
 * URI-safe-encoded so a payload containing a colon cannot collide with
 * a separator. Empty parts are rejected — they would corrupt the id space.
 */
export function formatDocId(
  source: ConnectorSource,
  parts: readonly string[],
): string {
  if (parts.length === 0) {
    throw new ConnectorError(source, "invalid_uri", "doc_id parts empty");
  }
  for (const p of parts) {
    if (p.length === 0) {
      throw new ConnectorError(source, "invalid_uri", "doc_id part empty");
    }
  }
  return `${source}:${parts.map((p) => encodeURIComponent(p)).join(":")}`;
}

/**
 * `fetch` with an AbortController-backed timeout. Throws `ConnectorError`
 * with code `timeout` on deadline; re-throws other errors unchanged so
 * the caller's source-specific error mapping (status code → code) can
 * apply. Default timeout: 10 s. `httpFetch` is injectable for tests.
 */
export async function fetchWithTimeout(
  source: ConnectorSource,
  url: string,
  init: RequestInit,
  timeoutMs = 10_000,
  httpFetch: typeof fetch = fetch,
): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await httpFetch(url, { ...init, signal: ac.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ConnectorError(
        source,
        "timeout",
        `request to ${url} exceeded ${timeoutMs}ms`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Standard validator for `TenantContext`. Every connector calls this
 * first thing in `list`/`fetch` to honour mesh §2 — a missing or empty
 * `tenant_id` is unauthorised, not a bug.
 */
export function requireTenant(
  source: ConnectorSource,
  ctx: { readonly tenant_id?: string },
): void {
  if (!ctx || typeof ctx.tenant_id !== "string" || ctx.tenant_id.length === 0) {
    throw new ConnectorError(
      source,
      "unauthorized",
      "tenant_id required on every connector call",
    );
  }
}
