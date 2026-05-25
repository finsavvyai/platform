/**
 * Demo fixtures for the Investigate UI when BRAIN_API_URL is unset.
 *
 * PII-free by construction:
 * - Subject ids are stable hash-shaped strings (no real names, no real IDs).
 * - Reason codes are stable enums (`sanctions_match`, `model_confidence_low`).
 * - Audit `actor_id` is a synthetic api-key id (`api-key_demo_*`).
 *
 * Three decisions exposed: one ALLOW, one FLAG, one BLOCK — covers the
 * full RecommendedAction enum and exercises every visual treatment
 * (DecisionPill, EngineScoreBadge, partial-result indicator).
 */
import type {
  AuditListResponse,
  DecisionDetailResponse,
  DecisionListResponse,
  InvestigateError,
} from './types.js';

const ISO_BASE = '2026-05-25T10:';

export const buildListFixture = (
  tenantId: string,
): DecisionListResponse => ({
  ok: true,
  tenant_id: tenantId,
  rows: [
    {
      decision_id: 'dec_01HXYZALLOW001',
      tenant_id: tenantId,
      ts: `${ISO_BASE}05:00Z`,
      subject_hash: 'sha256:0a1b2c3d4e5f',
      amount_minor: 125_00,
      currency: 'USD',
      channel: 'card',
      max_risk_score: 12,
      recommended_action: 'allow',
    },
    {
      decision_id: 'dec_01HXYZFLAG002',
      tenant_id: tenantId,
      ts: `${ISO_BASE}07:30Z`,
      subject_hash: 'sha256:9f8e7d6c5b4a',
      amount_minor: 9_500_00,
      currency: 'USD',
      channel: 'wire',
      max_risk_score: 62,
      recommended_action: 'flag',
    },
    {
      decision_id: 'dec_01HXYZBLOCK03',
      tenant_id: tenantId,
      ts: `${ISO_BASE}12:15Z`,
      subject_hash: 'sha256:dead_beef_1234',
      amount_minor: 48_750_00,
      currency: 'EUR',
      channel: 'wire',
      max_risk_score: 94,
      recommended_action: 'block',
    },
  ],
});

export const buildDetailFixture = (
  id: string,
  tenantId: string,
): DecisionDetailResponse | InvestigateError => {
  const list = buildListFixture(tenantId);
  const row = list.rows.find((r) => r.decision_id === id);
  if (!row) return { ok: false, error: 'decision_not_found' };
  return {
    ok: true,
    subject_hash: row.subject_hash,
    amount_minor: row.amount_minor,
    currency: row.currency,
    channel: row.channel,
    decision: {
      decision_id: row.decision_id,
      request_id: `req_${row.decision_id}`,
      tenant_id: row.tenant_id,
      ts: row.ts,
      max_risk_score: row.max_risk_score,
      recommended_action: row.recommended_action,
      confidence: row.recommended_action === 'block' ? 0.97 : 0.81,
      partial: false,
      engine_results: [
        {
          engine: 'quantumbeam',
          risk_score: row.max_risk_score,
          explanations: ['rule:high_value_wire', 'rule:cross_border'],
          latency_ms: 18,
        },
        {
          engine: 'ml-fraud',
          risk_score: Math.max(0, row.max_risk_score - 6),
          explanations: ['feature:velocity_24h', 'feature:mcc_pattern'],
          latency_ms: 22,
        },
      ],
      aggregated_explanation:
        row.recommended_action === 'block'
          ? ['sanctions_match', 'model_confidence_low']
          : ['model_signal_elevated'],
    },
  };
};

export const buildAuditFixture = (
  tenantId: string,
): AuditListResponse => ({
  ok: true,
  tenant_id: tenantId,
  records: buildListFixture(tenantId).rows.map((r, i) => ({
    ts: r.ts,
    actor_id: 'api-key_demo_001',
    tenant_id: r.tenant_id,
    event: 'aml.decision',
    resource: `${r.subject_hash}:${r.decision_id}`,
    decision:
      r.recommended_action === 'block'
        ? ('deny' as const)
        : ('allow' as const),
    reason:
      r.recommended_action === 'block'
        ? 'sanctions_match'
        : 'model_signal_elevated',
    chain_prev_hash: i === 0 ? '0'.repeat(64) : `chain_${i - 1}`,
    chain_hash: `chain_${i}`,
  })),
  chain: {
    verified: true,
    last_verified_ts: `${ISO_BASE}12:20Z`,
    head_hash: 'chain_2',
  },
});
