package types

import "time"

type Source string

const (
	SourceLLMGateway Source = "llm_gateway"
	SourceDLP        Source = "dlp"
	SourceOPA        Source = "opa"
	SourceRAG        Source = "rag"
	SourceUsage      Source = "usage"
)

type SignalEvent struct {
	ID          string         `json:"id"`
	TenantID    string         `json:"tenant_id"`
	Source      Source         `json:"source"`
	EventType   string         `json:"event_type"`
	SubjectUser string         `json:"subject_user,omitempty"`
	Model       string         `json:"model,omitempty"`
	Payload     map[string]any `json:"payload"`
	PayloadHash []byte         `json:"payload_hash"`
	Embedding   []float32      `json:"embedding,omitempty"`
	OccurredAt  time.Time      `json:"occurred_at"`
	IngestedAt  time.Time      `json:"ingested_at"`
}

type ScoreBreakdown struct {
	SOC2  float64 `json:"soc2"`
	HIPAA float64 `json:"hipaa"`
	GDPR  float64 `json:"gdpr"`
	Cost  float64 `json:"cost"`
	Blast float64 `json:"blast"`
}

type Insight struct {
	ID             string         `json:"id"`
	TenantID       string         `json:"tenant_id"`
	PatternID      string         `json:"pattern_id"`
	Severity       int            `json:"severity"`
	Status         string         `json:"status"`
	RawScore       float64        `json:"raw_score"`
	ImpactScore    float64        `json:"impact_score"`
	ScoreBreakdown ScoreBreakdown `json:"score_breakdown"`
	EvidenceIDs    []string       `json:"evidence_ids"`
	FirstSeen      time.Time      `json:"first_seen"`
	LastSeen       time.Time      `json:"last_seen"`
}

type Weights struct {
	SOC2  float64 `json:"soc2"`
	HIPAA float64 `json:"hipaa"`
	GDPR  float64 `json:"gdpr"`
	Cost  float64 `json:"cost"`
	Blast float64 `json:"blast"`
}

func DefaultWeights() Weights {
	return Weights{SOC2: 0.25, HIPAA: 0.25, GDPR: 0.20, Cost: 0.15, Blast: 0.15}
}

type Receipt struct {
	AdapterName string    `json:"adapter_name"`
	ExternalID  string    `json:"external_id,omitempty"`
	Signature   []byte    `json:"signature"`
	RawResponse []byte    `json:"raw_response,omitempty"`
	OccurredAt  time.Time `json:"occurred_at"`
}
