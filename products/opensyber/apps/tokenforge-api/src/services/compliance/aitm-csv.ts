/**
 * Compliance evidence — AitM CSV builder (Sprint 39 Task 12).
 *
 * Pure function that turns a list of `tf_security_events` rows into a
 * 15-column CSV per the Sprint 39 exit criterion (line 94 of PLAN.md):
 * "Compliance CSV passes shape validation (15 columns, AitM event
 * taxonomy)". 15 columns chosen so SOC2 / PCI DSS auditors get one
 * normalized row per AitM-relevant event without having to crack
 * `metadata` JSON themselves.
 *
 * Column order is part of the contract — moving columns will break any
 * downstream tooling. Headers are pinned in the test file.
 */

export interface SecurityEventRow {
  id: string;
  tenantId: string | null;
  sessionId: string;
  userId: string;
  eventType: string;
  trustScoreBefore: number | null;
  trustScoreAfter: number | null;
  ipAddress: string | null;
  countryCode: string | null;
  userAgent: string | null;
  metadata: string | null;
  createdAt: string;
}

export const AITM_CSV_HEADERS: readonly string[] = [
  'event_id',
  'tenant_id',
  'created_at_iso',
  'session_id',
  'user_id',
  'event_type',
  'trust_score_before',
  'trust_score_after',
  'ip_address',
  'country_code',
  'user_agent',
  'anomaly_kinds',
  'confidence',
  'action_taken',
  'evidence_hash',
];

const HASH_LEN = 32; // 16 bytes hex — short, deterministic, audit-grade

interface ParsedMetadata {
  anomalyKinds: string;
  confidence: string;
}

function parseMetadata(raw: string | null): ParsedMetadata {
  if (!raw) return { anomalyKinds: '', confidence: '' };
  try {
    const m = JSON.parse(raw) as Record<string, unknown>;
    const kinds = Array.isArray(m.signals)
      ? m.signals.map((s: unknown) => (typeof s === 'object' && s && 'kind' in s ? String((s as { kind: unknown }).kind) : '')).filter(Boolean).join('|')
      : '';
    const conf = typeof m.confidence === 'string' ? m.confidence : '';
    return { anomalyKinds: kinds, confidence: conf };
  } catch {
    return { anomalyKinds: '', confidence: '' };
  }
}

function actionFromEventType(eventType: string): string {
  // Underscore-separated suffixes (`dbsc.session_revoked`, `dbsc.policy_block`)
  // and dot-separated suffixes (`trust.block`) both occur in dispatched events
  // so substring match is the correct contract — just keep the order so
  // step_up wins over block when both could ambiguously match.
  if (eventType.includes('step_up')) return 'step_up';
  if (eventType.includes('block')) return 'block';
  if (eventType.includes('revoke')) return 'revoke';
  if (eventType.endsWith('.allow')) return 'allow';
  return 'log';
}

/**
 * Deterministic short hash for the row — SHA-256 over the metadata blob,
 * truncated to HASH_LEN hex chars. Lets auditors detect tampering
 * without exposing the full payload.
 */
async function evidenceHash(rowId: string, metadata: string | null): Promise<string> {
  const buf = new TextEncoder().encode(`${rowId}::${metadata ?? ''}`);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hashBuf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i]!.toString(16).padStart(2, '0');
  return hex.slice(0, HASH_LEN);
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function buildAitmCsv(rows: SecurityEventRow[]): Promise<string> {
  const lines: string[] = [AITM_CSV_HEADERS.join(',')];
  for (const r of rows) {
    const meta = parseMetadata(r.metadata);
    const hash = await evidenceHash(r.id, r.metadata);
    const cols = [
      r.id, r.tenantId, r.createdAt, r.sessionId, r.userId, r.eventType,
      r.trustScoreBefore, r.trustScoreAfter, r.ipAddress, r.countryCode, r.userAgent,
      meta.anomalyKinds, meta.confidence, actionFromEventType(r.eventType), hash,
    ];
    if (cols.length !== AITM_CSV_HEADERS.length) {
      throw new Error(`buildAitmCsv: column-count drift (${cols.length} vs ${AITM_CSV_HEADERS.length})`);
    }
    lines.push(cols.map(csvEscape).join(','));
  }
  return lines.join('\n') + '\n';
}
