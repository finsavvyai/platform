export type Source =
  | "llm_gateway"
  | "dlp"
  | "opa"
  | "rag"
  | "usage";

export interface SignalEvent {
  id: string;
  tenant_id: string;
  source: Source;
  event_type: string;
  subject_user?: string;
  model?: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  embedding?: number[];
  occurred_at: string;
  ingested_at: string;
}

export interface ScoreBreakdown {
  soc2: number;
  hipaa: number;
  gdpr: number;
  cost: number;
  blast: number;
}

export interface Weights {
  soc2: number;
  hipaa: number;
  gdpr: number;
  cost: number;
  blast: number;
}

export const defaultWeights = (): Weights => ({
  soc2: 0.25,
  hipaa: 0.25,
  gdpr: 0.20,
  cost: 0.15,
  blast: 0.15,
});

export interface Insight {
  id: string;
  tenant_id: string;
  pattern_id: string;
  severity: 1 | 2 | 3 | 4 | 5;
  status: "open" | "acting" | "resolved" | "dismissed";
  raw_score: number;
  impact_score: number;
  score_breakdown: ScoreBreakdown;
  evidence_ids: string[];
  first_seen: string;
  last_seen: string;
}

export interface Receipt {
  adapter_name: string;
  external_id?: string;
  signature: string;
  raw_response?: string;
  occurred_at: string;
}
