package alerting

import (
	"context"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
)

// Persister is the narrow persistence contract (pgx repo implements).
type Persister interface {
	Record(ctx context.Context, a domain.ListSyncAudit) error
}

// BuildDefaultChannels composes audit-events + email + whatsapp + slack,
// skipping any channel whose constructor returned nil (unconfigured).
func BuildDefaultChannels(auditStore AuditStore) []Channel {
	out := []Channel{NewAuditEventsChannel(auditStore)}
	if em := NewEmailChannel(); em != nil {
		out = append(out, em)
	}
	if sl := NewSlackChannel(); sl != nil {
		out = append(out, sl)
	}
	if wa := NewWhatsAppChannel(); wa != nil {
		out = append(out, wa)
	}
	names := make([]string, len(out))
	for i, c := range out {
		names[i] = c.Name()
	}
	log.Printf("alerting: active channels %v", names)
	return out
}

// RecordingAlerter is a single SyncRecorder that persists AND fires
// alerts — the thing you wire into RefreshService.
type RecordingAlerter struct {
	persister Persister
	alerter   *ListSyncAlerter
}

// NewRecordingAlerter glues a persister + channels together.
func NewRecordingAlerter(p Persister, channels []Channel) *RecordingAlerter {
	return &RecordingAlerter{
		persister: p,
		alerter:   NewListSyncAlerter(channels, time.Hour),
	}
}

// Record implements ingestion.SyncRecorder: persist first, alert on
// failure. Persistence errors are logged but do not mask the sync
// outcome — the caller already has the sync err in hand.
func (r *RecordingAlerter) Record(
	ctx context.Context, a domain.ListSyncAudit,
) error {
	if err := r.persister.Record(ctx, a); err != nil {
		log.Printf("list_sync_audit persist failed: %v", err)
	}
	r.alerter.Fire(ctx, a)
	return nil
}

// compile-time check that RecordingAlerter satisfies the port.
var _ ingestion.SyncRecorder = (*RecordingAlerter)(nil)
