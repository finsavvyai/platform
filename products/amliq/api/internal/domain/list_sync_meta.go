package domain

import (
	"fmt"
	"time"
)

// ListSyncMeta records the last sync state for a list within a tenant.
type ListSyncMeta struct {
	TenantID    TenantID
	ListID      string
	ETag        string
	EntityCount int
	SyncedAt    time.Time
	NextSyncAt  time.Time
}

// NewListSyncMeta creates a validated sync metadata record.
func NewListSyncMeta(tenantID TenantID, listID string) (ListSyncMeta, error) {
	if tenantID.IsZero() {
		return ListSyncMeta{}, fmt.Errorf("tenantID required")
	}
	if listID == "" {
		return ListSyncMeta{}, fmt.Errorf("listID required")
	}
	return ListSyncMeta{
		TenantID: tenantID,
		ListID:   listID,
		SyncedAt: time.Now().UTC(),
	}, nil
}

// Validate checks that sync metadata is sound.
func (m ListSyncMeta) Validate() error {
	if m.TenantID.IsZero() {
		return fmt.Errorf("tenantID required")
	}
	if m.ListID == "" {
		return fmt.Errorf("listID required")
	}
	if m.EntityCount < 0 {
		return fmt.Errorf("entityCount cannot be negative")
	}
	return nil
}
