package domain

import (
	"fmt"
	"time"
)

type AuditEntry struct {
	ID           string
	TenantID     TenantID
	Timestamp    time.Time
	Action       AuditAction
	ActorID      string
	ResourceType string
	ResourceID   string
	Details      map[string]interface{}
	PreviousHash string
	Hash         string
}

func NewAuditEntry(
	tenantID TenantID,
	action AuditAction,
	actorID string,
	resourceType string,
	resourceID string,
) (AuditEntry, error) {
	if tenantID.IsZero() || actorID == "" {
		return AuditEntry{}, fmt.Errorf("tenant id and actor id required")
	}
	return AuditEntry{
		ID:           "aud_" + fmt.Sprintf("%d", time.Now().UnixNano()),
		TenantID:     tenantID,
		Timestamp:    time.Now().UTC(),
		Action:       action,
		ActorID:      actorID,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Details:      make(map[string]interface{}),
	}, nil
}

func (ae AuditEntry) String() string {
	return fmt.Sprintf("%s:%s", ae.Action.String(), ae.ResourceID)
}
