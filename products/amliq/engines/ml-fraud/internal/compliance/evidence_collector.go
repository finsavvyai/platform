package compliance

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// EvidenceProvider defines the interface for collecting compliance evidence.
type EvidenceProvider interface {
	Collect(ctx context.Context, tenantID string, evidenceType EvidenceType) ([]EvidenceItem, error)
}

// EvidenceCollector orchestrates evidence collection from registered providers.
type EvidenceCollector struct {
	providers map[EvidenceType]EvidenceProvider
}

// NewEvidenceCollector creates an EvidenceCollector with an empty provider map.
func NewEvidenceCollector() *EvidenceCollector {
	return &EvidenceCollector{
		providers: make(map[EvidenceType]EvidenceProvider),
	}
}

// RegisterProvider registers a provider for the given evidence type.
func (ec *EvidenceCollector) RegisterProvider(evidenceType EvidenceType, provider EvidenceProvider) {
	ec.providers[evidenceType] = provider
}

// CollectEvidence gathers evidence for the specified types and control.
// Missing providers are silently skipped. Provider errors are returned immediately.
func (ec *EvidenceCollector) CollectEvidence(
	ctx context.Context,
	tenantID string,
	controlID string,
	evidenceTypes []EvidenceType,
) ([]EvidenceItem, error) {
	var results []EvidenceItem
	now := time.Now()

	for _, et := range evidenceTypes {
		provider, ok := ec.providers[et]
		if !ok {
			continue
		}

		items, err := provider.Collect(ctx, tenantID, et)
		if err != nil {
			return nil, fmt.Errorf("provider %s failed: %w", et, err)
		}

		for i := range items {
			items[i].ControlID = controlID
			items[i].ID = uuid.New().String()
			items[i].CollectedAt = now
			items[i].Hash = hashEvidence(items[i].Data)
		}

		results = append(results, items...)
	}

	return results, nil
}

// CollectAll gathers evidence from every registered provider.
func (ec *EvidenceCollector) CollectAll(
	ctx context.Context,
	tenantID string,
	controlID string,
) ([]EvidenceItem, error) {
	types := make([]EvidenceType, 0, len(ec.providers))
	for et := range ec.providers {
		types = append(types, et)
	}
	return ec.CollectEvidence(ctx, tenantID, controlID, types)
}

// hashEvidence returns the SHA-256 hex digest of data.
func hashEvidence(data string) string {
	h := sha256.Sum256([]byte(data))
	return fmt.Sprintf("%x", h)
}
