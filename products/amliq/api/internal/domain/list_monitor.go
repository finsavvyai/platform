package domain

import (
	"fmt"
	"time"
)

// ListMonitor tracks per-tenant list sync state.
type ListMonitor struct {
	ID           string
	TenantID     TenantID
	ListSource   string
	LastSyncedAt *time.Time
	NextSyncAt   time.Time
	Status       string
	ErrorMessage string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// NewListMonitor creates a monitor for a tenant+list pair.
func NewListMonitor(
	tenantID TenantID, listSource string, nextSync time.Time,
) (ListMonitor, error) {
	if tenantID.IsZero() {
		return ListMonitor{}, fmt.Errorf("tenant id required")
	}
	if listSource == "" {
		return ListMonitor{}, fmt.Errorf("list source required")
	}
	now := time.Now().UTC()
	id := fmt.Sprintf("lm_%s_%s", tenantID.String(), listSource)
	return ListMonitor{
		ID:         id,
		TenantID:   tenantID,
		ListSource: listSource,
		NextSyncAt: nextSync,
		Status:     "pending",
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}
