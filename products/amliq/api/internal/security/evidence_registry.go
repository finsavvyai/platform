package security

import (
	"context"
	"fmt"
)

type EvidenceRegistry struct {
	collectors map[string]EvidenceCollector
	evidence   map[string][]Evidence
}

func NewEvidenceRegistry() *EvidenceRegistry {
	return &EvidenceRegistry{
		collectors: make(map[string]EvidenceCollector),
		evidence:   make(map[string][]Evidence),
	}
}

func (er *EvidenceRegistry) Register(name string, collector EvidenceCollector) {
	er.collectors[name] = collector
	er.evidence[name] = []Evidence{}
}

func (er *EvidenceRegistry) CollectEvidence(
	ctx context.Context,
	collectorName string,
	evidenceType EvidenceType,
	tenantID string,
	period TimeRange,
) (Evidence, error) {
	collector, exists := er.collectors[collectorName]
	if !exists {
		return Evidence{}, fmt.Errorf("collector not found: %s", collectorName)
	}

	evidence, err := collector.Collect(ctx, evidenceType, tenantID, period)
	if err != nil {
		return Evidence{}, err
	}

	er.evidence[collectorName] = append(er.evidence[collectorName], evidence)
	return evidence, nil
}

func (er *EvidenceRegistry) GetEvidence(collectorName string) []Evidence {
	if evds, exists := er.evidence[collectorName]; exists {
		return evds
	}
	return []Evidence{}
}
