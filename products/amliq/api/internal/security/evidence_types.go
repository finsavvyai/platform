package security

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"
)

type EvidenceType string

const (
	EvidenceTypeAccessLog      EvidenceType = "ACCESS_LOG"
	EvidenceTypeChangeRecord   EvidenceType = "CHANGE_RECORD"
	EvidenceTypeIncidentReport EvidenceType = "INCIDENT_REPORT"
	EvidenceTypePolicyDoc      EvidenceType = "POLICY_DOC"
	EvidenceTypeTestResult     EvidenceType = "TEST_RESULT"
)

type TimeRange struct {
	Start time.Time
	End   time.Time
}

type Evidence struct {
	ID          string
	Type        EvidenceType
	CollectorID string
	TenantID    string
	Period      TimeRange
	Hash        string
	Timestamp   time.Time
	Metadata    map[string]interface{}
}

func NewEvidence(
	evidenceType EvidenceType,
	collectorID string,
	tenantID string,
	period TimeRange,
) (Evidence, error) {
	if collectorID == "" || tenantID == "" {
		return Evidence{}, fmt.Errorf("collector id and tenant id required")
	}
	if period.Start.IsZero() || period.End.IsZero() {
		return Evidence{}, fmt.Errorf("time period required")
	}

	return Evidence{
		ID:          "evd_" + fmt.Sprintf("%d", time.Now().UnixNano()),
		Type:        evidenceType,
		CollectorID: collectorID,
		TenantID:    tenantID,
		Period:      period,
		Timestamp:   time.Now().UTC(),
		Metadata:    make(map[string]interface{}),
	}, nil
}

func (e *Evidence) SetHash(data []byte) {
	hash := sha256.Sum256(data)
	e.Hash = fmt.Sprintf("%x", hash)
}

func (e *Evidence) SetHashString(data string) {
	e.SetHash([]byte(data))
}

func (e Evidence) IsValid() bool {
	return e.ID != "" && e.Type != "" &&
		e.CollectorID != "" && e.TenantID != "" &&
		e.Hash != "" && !e.Period.Start.IsZero() &&
		!e.Period.End.IsZero()
}

type EvidenceCollector interface {
	Collect(ctx context.Context, evidenceType EvidenceType,
		tenantID string, period TimeRange) (Evidence, error)
	Export(ctx context.Context, evidence Evidence) ([]byte, error)
	Validate(ctx context.Context, evidence Evidence) error
}
