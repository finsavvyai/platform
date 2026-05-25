// SSRF guard for third-party CI bridge baseUrls (M-002 / M-003).
//
// User-supplied `baseUrl` on /connect endpoints (GitLab self-hosted,
// Jenkins) is fetched directly by the Worker. On Cloudflare that's safe
// (egress can't reach RFC1918) — but the v1.6.6 self-hosted docker-compose
// build has no such sandbox. An authed low-privilege tenant could scan the
// host VPC via blind SSRF. Validate once at /connect and again at every
// outbound fetch for defence in depth.
//
// Rules (all must hold — any failure returns null):
//   1. URL must parse (WHATWG `new URL`).
//   2. Protocol must be exactly `https:`.
//   3. No credentials in the URL (`user:pass@host`).
//   4. Hostname MUST match an allowlist entry, either exactly or as a
//      subdomain bounded by a dot (so `gitlab.com.attacker.com` fails).
//      When `allowlist` is a wildcard `["*"]`, any hostname passes this
//      check — used in managed mode where egress is already sandboxed.
//   5. Hostname must not resolve (textually) to a private/loopback/
//      link-local/cloud-metadata address — applies EVEN IF the hostname
//      is allowlisted, so operators who accidentally list `127.0.0.1`
//      still can't SSRF themselves.
//
// License: Apache-2.0

export { isPrivateHost } from "./cepien-callback-guard";
import { isPrivateHost } from "./cepien-callback-guard";

/** Normalize an allowlist entry: lowercase, strip leading/trailing dots. */
function normalizeEntry(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\.+/, "").replace(/\.+$/, "");
}

/** Parse a comma-separated env var into a hostname allowlist. Empty → []. */
export function parseAllowedHosts(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map(normalizeEntry)
    .filter((s) => s.length > 0);
}

/** True iff `host` exactly equals `entry` or ends with `.entry`. */
function hostMatches(host: string, entry: string): boolean {
  const h = host.toLowerCase();
  const e = normalizeEntry(entry);
  if (!e) return false;
  if (h === e) return true;
  return h.endsWith(`.${e}`);
}

/** True iff `host` matches any allowlist entry (suffix-boundary aware). */
export function hostInAllowlist(host: string, allowlist: readonly string[]): boolean {
  if (allowlist.includes("*")) return true;
  for (const entry of allowlist) if (hostMatches(host, entry)) return true;
  return false;
}

/**
 * Parse and validate a bridge baseUrl against an allowlist. Returns a
 * parsed URL on success, null on any failure. No throws, no DNS, no fetch.
 */
export function validateBridgeUrl(raw: unknown, allowlist: readonly string[]): URL | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname;
  if (!host) return null;
  if (!hostInAllowlist(host, allowlist)) return null;
  // Belt-and-suspenders: reject private IP even if the operator allowlisted it.
  if (isPrivateHost(host)) return null;
  return u;
}

export type BridgeKind = "gitlab" | "jenkins" | "bitbucket";

interface BridgeProfile {
  /** Hostnames always accepted (SaaS endpoints). */
  defaults: readonly string[];
  /** Env var whose CSV value extends the allowlist (self-hosted instances). */
  envVar: string;
  /** When true, self-hosted PushCI must provide env or baseUrl is blocked. */
  requiresEnvWhenSelfHosted: boolean;
}

const PROFILES: Record<BridgeKind, BridgeProfile> = {
  gitlab: { defaults: ["gitlab.com"], envVar: "PUSHCI_GITLAB_ALLOWED_HOSTS", requiresEnvWhenSelfHosted: false },
  // Jenkins has no SaaS — every deployment is self-hosted. Operators on
  // self-hosted PushCI MUST set PUSHCI_JENKINS_ALLOWED_HOSTS explicitly or
  // the bridge is blocked.
  jenkins: { defaults: [], envVar: "PUSHCI_JENKINS_ALLOWED_HOSTS", requiresEnvWhenSelfHosted: true },
  bitbucket: {
    defaults: ["bitbucket.org", "api.bitbucket.org"],
    envVar: "PUSHCI_BITBUCKET_ALLOWED_HOSTS",
    requiresEnvWhenSelfHosted: false,
  },
};

/** True iff the Worker is running inside the self-hosted docker-compose. */
export function isSelfHosted(env: Record<string, string | undefined>): boolean {
  const v = env.PUSHCI_SELF_HOSTED;
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/**
 * Resolve the effective allowlist for a bridge, combining static defaults
 * with any operator-supplied env override. In managed mode, if the env is
 * empty AND there are no defaults (Jenkins), fall back to wildcard because
 * CF Workers egress can't reach RFC1918 anyway. In self-hosted mode, the
 * `requiresEnvWhenSelfHosted` flag forces explicit opt-in.
 */
export function resolveAllowlist(
  kind: BridgeKind,
  env: Record<string, string | undefined>
): readonly string[] {
  const profile = PROFILES[kind];
  const envHosts = parseAllowedHosts(env[profile.envVar]);
  const combined = [...profile.defaults, ...envHosts];
  if (combined.length > 0) return combined;
  if (isSelfHosted(env)) return []; // blocked
  return ["*"]; // managed: egress already sandboxed
}

/**
 * Convenience wrapper — looks up the bridge's allowlist from env and
 * validates the URL in one call. Returns null if the URL is blocked OR
 * if the bridge requires an env allowlist that is missing in self-hosted mode.
 */
export function validateForBridge(
  raw: unknown,
  kind: BridgeKind,
  env: Record<string, string | undefined>
): URL | null {
  const allowlist = resolveAllowlist(kind, env);
  if (allowlist.length === 0) return null;
  return validateBridgeUrl(raw, allowlist);
}
