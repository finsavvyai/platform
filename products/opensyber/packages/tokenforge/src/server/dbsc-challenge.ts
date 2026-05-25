/**
 * DBSC challenge issuer — emits the random bytes the client must sign,
 * stores their SHA-256 hash + a 60-second expiry, and consumes them
 * exactly once.
 *
 * The challenge bytes never live at rest — we store only the hash so a
 * DB read does not let an attacker pre-compute valid signatures.
 *
 * Pure logic; persistence is injected so this works on any storage.
 */

const CHALLENGE_BYTES = 32;
const DEFAULT_TTL_SECONDS = 60;

export interface ChallengeStore {
  put(record: ChallengeRecord): Promise<void>;
  takeIfFresh(hash: string, now: Date): Promise<ChallengeRecord | null>;
}

export interface ChallengeRecord {
  id: string;
  tenantId: string;
  challengeHash: string;
  purpose: 'register' | 'refresh' | 'step_up';
  sessionId?: string | null;
  actionHash?: string | null;
  issuedAt: string;
  expiresAt: string;
  consumed: boolean;
}

export interface IssueChallengeInput {
  tenantId: string;
  purpose: ChallengeRecord['purpose'];
  sessionId?: string;
  actionHash?: string;
  ttlSeconds?: number;
}

export interface IssueChallengeOutput {
  /** base64url-encoded random bytes — send to the client. */
  challenge: string;
  /** Stored record, returned for callers who need the id/expiry. */
  record: ChallengeRecord;
}

export async function issueChallenge(
  store: ChallengeStore,
  input: IssueChallengeInput,
): Promise<IssueChallengeOutput> {
  const bytes = new Uint8Array(CHALLENGE_BYTES);
  crypto.getRandomValues(bytes);
  const challenge = bytesToBase64Url(bytes);
  const challengeHash = await sha256Base64Url(bytes);
  const ttl = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const issued = new Date();
  const expires = new Date(issued.getTime() + ttl * 1000);
  const record: ChallengeRecord = {
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    challengeHash,
    purpose: input.purpose,
    sessionId: input.sessionId ?? null,
    actionHash: input.actionHash ?? null,
    issuedAt: issued.toISOString(),
    expiresAt: expires.toISOString(),
    consumed: false,
  };
  await store.put(record);
  return { challenge, record };
}

export async function consumeChallenge(
  store: ChallengeStore,
  challenge: string,
  expected: { tenantId: string; purpose: ChallengeRecord['purpose']; sessionId?: string },
): Promise<{ ok: true; record: ChallengeRecord } | { ok: false; reason: string }> {
  const bytes = base64UrlToBytes(challenge);
  if (!bytes) return { ok: false, reason: 'malformed_challenge' };
  const hash = await sha256Base64Url(bytes);
  const found = await store.takeIfFresh(hash, new Date());
  if (!found) return { ok: false, reason: 'challenge_unknown_or_expired' };
  if (found.consumed) return { ok: false, reason: 'challenge_replay' };
  if (found.tenantId !== expected.tenantId) return { ok: false, reason: 'challenge_tenant_mismatch' };
  if (found.purpose !== expected.purpose) return { ok: false, reason: 'challenge_purpose_mismatch' };
  if (expected.sessionId && found.sessionId !== expected.sessionId) {
    return { ok: false, reason: 'challenge_session_mismatch' };
  }
  return { ok: true, record: found };
}

async function sha256Base64Url(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return bytesToBase64Url(new Uint8Array(buf));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64: string): Uint8Array | null {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
