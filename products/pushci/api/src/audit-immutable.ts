// Hash-chained tamper-evident audit log.
//
// Every new audit entry is linked to the previous one via SHA-256:
//   entry_hash = SHA-256( canonicalJson(entry) + previous_hash )
// The tail hash is persisted in KV per tenant, so new appends always chain
// off the latest persisted state even across Workers isolates.
//
// Because the existing audit_logs table predates hash chaining, chain data
// is embedded inside details_json under the reserved `_chain` key. Readers
// that don't care about chain metadata can ignore that field.

export interface AuditChainEntry {
  actor_sub: string | null;
  actor_login: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
}

export interface AuditChainRow {
  id: number;
  actor_sub: string | null;
  actor_login: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details_json: string;
  created_at: string;
}

export interface ChainMetadata {
  prev_hash: string;
  entry_hash: string;
  chained_at: string;
}

export interface VerifyResult {
  valid: boolean;
  checked: number;
  brokenAt?: number;
  reason?: string;
}

const GENESIS_HASH = "0".repeat(64);
const CHAIN_KEY = "_chain";

// Canonical JSON: deterministic key ordering so the same entry always
// produces the same hash regardless of property insertion order.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k]));
  return "{" + parts.join(",") + "}";
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export async function computeEntryHash(
  entry: AuditChainEntry,
  previousHash: string,
): Promise<string> {
  const payload = canonicalJson(entry) + previousHash;
  const encoded = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toHex(digest);
}

async function readTailHash(kv: KVNamespace, tenantId: string): Promise<string> {
  const key = `audit:tail_hash:${tenantId}`;
  const stored = await kv.get(key);
  return stored || GENESIS_HASH;
}

async function writeTailHash(
  kv: KVNamespace,
  tenantId: string,
  hash: string,
): Promise<void> {
  await kv.put(`audit:tail_hash:${tenantId}`, hash);
}

// Append a single entry to the hash-chained audit log.
// Returns the computed entry_hash so callers can reference it.
export async function appendAuditHashChain(
  db: D1Database,
  kv: KVNamespace,
  tenantId: string,
  entry: AuditChainEntry,
): Promise<{ entry_hash: string; prev_hash: string }> {
  const prev_hash = await readTailHash(kv, tenantId);
  const entry_hash = await computeEntryHash(entry, prev_hash);
  const chained_at = new Date().toISOString();

  const details = {
    ...entry.details,
    [CHAIN_KEY]: { prev_hash, entry_hash, chained_at, tenant: tenantId } as ChainMetadata & {
      tenant: string;
    },
  };

  await db
    .prepare(
      `INSERT INTO audit_logs (actor_sub, actor_login, action, resource_type, resource_id, details_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entry.actor_sub,
      entry.actor_login,
      entry.action,
      entry.resource_type,
      entry.resource_id,
      JSON.stringify(details),
    )
    .run();

  await writeTailHash(kv, tenantId, entry_hash);
  return { entry_hash, prev_hash };
}

export function extractChainMetadata(details_json: string): ChainMetadata | null {
  try {
    const parsed = JSON.parse(details_json) as Record<string, unknown>;
    const meta = parsed[CHAIN_KEY] as ChainMetadata | undefined;
    if (!meta || typeof meta.entry_hash !== "string" || typeof meta.prev_hash !== "string") {
      return null;
    }
    return { prev_hash: meta.prev_hash, entry_hash: meta.entry_hash, chained_at: meta.chained_at };
  } catch {
    return null;
  }
}

// Reconstruct the entry payload (without chain metadata) from a row and
// recompute its hash; returns true if the hash matches the stored one.
export async function verifyRow(row: AuditChainRow): Promise<{
  ok: boolean;
  expected?: string;
  actual?: string;
}> {
  const meta = extractChainMetadata(row.details_json);
  if (!meta) return { ok: false };
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(row.details_json);
  } catch {
    return { ok: false };
  }
  const { [CHAIN_KEY]: _omit, ...rest } = parsed;
  void _omit;
  const entry: AuditChainEntry = {
    actor_sub: row.actor_sub,
    actor_login: row.actor_login,
    action: row.action,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    details: rest,
  };
  const recomputed = await computeEntryHash(entry, meta.prev_hash);
  return { ok: recomputed === meta.entry_hash, expected: meta.entry_hash, actual: recomputed };
}

// Walk the chain from fromId..toId (inclusive) and check each row links to
// the previous one and hashes correctly. Returns brokenAt = id of first
// offending row if the chain has been tampered with.
export async function verifyAuditChain(
  db: D1Database,
  fromId: number,
  toId: number,
): Promise<VerifyResult> {
  const { results } = await db
    .prepare(
      `SELECT id, actor_sub, actor_login, action, resource_type, resource_id, details_json, created_at
       FROM audit_logs WHERE id >= ? AND id <= ? ORDER BY id ASC`,
    )
    .bind(fromId, toId)
    .all<AuditChainRow>();

  const rows = (results ?? []) as AuditChainRow[];
  if (rows.length === 0) return { valid: true, checked: 0 };

  let expectedPrev: string | null = null;
  let checked = 0;
  for (const row of rows) {
    const meta = extractChainMetadata(row.details_json);
    if (!meta) {
      return { valid: false, checked, brokenAt: row.id, reason: "missing_chain_metadata" };
    }
    if (expectedPrev !== null && meta.prev_hash !== expectedPrev) {
      return { valid: false, checked, brokenAt: row.id, reason: "prev_hash_mismatch" };
    }
    const verdict = await verifyRow(row);
    if (!verdict.ok) {
      return { valid: false, checked, brokenAt: row.id, reason: "entry_hash_mismatch" };
    }
    expectedPrev = meta.entry_hash;
    checked++;
  }
  return { valid: true, checked };
}

export const AUDIT_CHAIN_GENESIS = GENESIS_HASH;
