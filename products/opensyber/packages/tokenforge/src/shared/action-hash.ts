/**
 * Shared canonicalization + hash helper for action signing.
 *
 * Client (`client/action-signer.ts`) and server
 * (`server/action-verify.ts`) MUST agree on these byte-for-byte;
 * sharing this file is the simplest enforcement.
 */

export interface ActionLikePayload {
  action: string;
  [key: string]: unknown;
}

/**
 * Stable JSON serialization — sorts top-level keys so `{a:1,b:2}` and
 * `{b:2,a:1}` produce the same string. JS object literals preserve
 * insertion order, so without this two semantically-identical
 * payloads from different code paths would hash differently and the
 * server would reject one of them as a tamper.
 */
export function canonicalizeAction(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = payload[k];
  return JSON.stringify(ordered);
}

export async function sha256B64Url(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return b64UrlEncodeBytes(new Uint8Array(buf));
}

export async function hashActionPayload(payload: Record<string, unknown>): Promise<string> {
  return sha256B64Url(canonicalizeAction(payload));
}

export function b64UrlEncodeBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
