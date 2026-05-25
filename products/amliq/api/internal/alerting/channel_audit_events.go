package alerting

import (
	"context"
	"strconv"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/security"
)

// AuditStore is the subset of security.AuditStore the channel needs.
// Narrow interface so tests can swap in a stub.
type AuditStore interface {
	Save(ctx context.Context, entry security.AuditEntry) error
}

// AuditEventsChannel writes a security.AuditEntry with
// action='list_sync_failed' — the existing /admin/health page
// surfaces these as red-banner notifications for admins.
type AuditEventsChannel struct{ store AuditStore }

// NewAuditEventsChannel constructs the channel.
func NewAuditEventsChannel(s AuditStore) *AuditEventsChannel {
	return &AuditEventsChannel{store: s}
}

// Name implements Channel.
func (c *AuditEventsChannel) Name() string { return "audit_events" }

// Send implements Channel.
func (c *AuditEventsChannel) Send(
	ctx context.Context, a domain.ListSyncAudit,
) error {
	if c.store == nil {
		return nil
	}
	return c.store.Save(ctx, security.AuditEntry{
		Timestamp: time.Now().UTC(),
		TenantID:  a.TenantID,
		Action:    "list_sync_failed",
		Details: map[string]string{
			"list_id":         a.ListID,
			"duration_ms":     strconv.Itoa(a.DurationMS),
			"fetch_strategy":  a.FetchStrategy,
			"triggered_by":    a.TriggeredBy,
			"entities_before": strconv.Itoa(a.EntitiesBefore),
			"entities_after":  strconv.Itoa(a.EntitiesAfter),
			"error":           a.Error,
		},
	})
}
