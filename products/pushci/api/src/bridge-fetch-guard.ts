// Defence-in-depth fetch-time baseUrl check for CI bridges (M-002/M-003).
// The primary allowlist enforcement happens at each /connect route; this
// module re-validates at fetch time so a stored baseUrl that somehow
// bypassed connect (e.g. future admin override, migrated record) cannot
// SSRF the runtime host. Fails closed via Error.
// License: Apache-2.0

import { isPrivateHost } from "./bridge-url-guard";

/** Core fetch-time rules: HTTPS, no creds, not RFC1918/loopback/link-local. */
export function assertSafeBaseUrl(baseUrl: string, bridge: string): void {
  let u: URL;
  try {
    u = new URL(baseUrl);
  } catch {
    throw new Error(`${bridge} baseUrl invalid: ${baseUrl}`);
  }
  if (u.protocol !== "https:") throw new Error(`${bridge} baseUrl must be https: ${baseUrl}`);
  if (u.username || u.password) throw new Error(`${bridge} baseUrl must not contain credentials`);
  if (isPrivateHost(u.hostname)) {
    throw new Error(`${bridge} baseUrl resolves to private host: ${u.hostname}`);
  }
}
