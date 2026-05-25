package security

import (
	"context"
	"fmt"
	"time"
)

type DefaultEvidenceCollector struct {
	name string
	logs []Evidence
}

func NewDefaultEvidenceCollector(name string) *DefaultEvidenceCollector {
	return &DefaultEvidenceCollector{
		name: name,
		logs: []Evidence{},
	}
}

func (dec *DefaultEvidenceCollector) Collect(
	ctx context.Context,
	evidenceType EvidenceType,
	tenantID string,
	period TimeRange,
) (Evidence, error) {
	if tenantID == "" {
		return Evidence{}, fmt.Errorf("tenant id required")
	}
	if period.Start.IsZero() || period.End.IsZero() {
		return Evidence{}, fmt.Errorf("time period required")
	}

	evidence, err := NewEvidence(evidenceType, dec.name, tenantID, period)
	if err != nil {
		return Evidence{}, err
	}

	evidence.Metadata["collector"] = dec.name
	evidence.Metadata["collected_at"] = time.Now().UTC()
	evidence.Metadata["period_start"] = period.Start
	evidence.Metadata["period_end"] = period.End

	data := fmt.Sprintf("%s:%s:%d:%d",
		evidence.Type, tenantID,
		period.Start.Unix(), period.End.Unix())
	evidence.SetHashString(data)

	dec.logs = append(dec.logs, evidence)

	return evidence, nil
}

func (dec *DefaultEvidenceCollector) Export(
	ctx context.Context,
	evidence Evidence,
) ([]byte, error) {
	if evidence.ID == "" {
		return nil, fmt.Errorf("invalid evidence: missing id")
	}

	output := fmt.Sprintf(
		"Evidence Report\n"+
			"ID: %s\n"+
			"Type: %s\n"+
			"Collector: %s\n"+
			"Tenant: %s\n"+
			"Period: %s to %s\n"+
			"Hash: %s\n"+
			"Timestamp: %s\n",
		evidence.ID,
		evidence.Type,
		evidence.CollectorID,
		evidence.TenantID,
		evidence.Period.Start.Format(time.RFC3339),
		evidence.Period.End.Format(time.RFC3339),
		evidence.Hash,
		evidence.Timestamp.Format(time.RFC3339),
	)

	return []byte(output), nil
}

func (dec *DefaultEvidenceCollector) Validate(
	ctx context.Context,
	evidence Evidence,
) error {
	if !evidence.IsValid() {
		return fmt.Errorf("evidence failed validation: missing fields")
	}

	if evidence.Period.End.Before(evidence.Period.Start) {
		return fmt.Errorf("evidence period invalid: end before start")
	}

	if evidence.Hash == "" {
		return fmt.Errorf("evidence hash required for validation")
	}

	return nil
}
