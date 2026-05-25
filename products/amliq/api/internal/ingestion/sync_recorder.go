package ingestion

import (
	"context"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SyncRecorder persists a ListSyncAudit row and (optionally) fans out
// alerts to the admin. Implementations live in internal/storage/pgx
// and internal/alerting.
type SyncRecorder interface {
	Record(ctx context.Context, audit domain.ListSyncAudit) error
}

// noopRecorder swallows audits — used when wiring hasn't been
// provided (e.g. tests, local `go run` without the DB repo).
type noopRecorder struct{}

// NewNoopRecorder returns a recorder that discards audits.
func NewNoopRecorder() SyncRecorder { return &noopRecorder{} }

// Record implements SyncRecorder.
func (n *noopRecorder) Record(context.Context, domain.ListSyncAudit) error {
	return nil
}

// newAuditFrom builds a base audit row for one SyncList call; callers
// finalise Status, FinishedAt, Error, Delta, EntitiesAfter as the
// sync progresses.
func newAuditFrom(
	tenantID, triggeredBy string, lc domain.ListConfig,
) domain.ListSyncAudit {
	return domain.ListSyncAudit{
		TenantID:    tenantID,
		ListID:      lc.ListID,
		StartedAt:   time.Now().UTC(),
		TriggeredBy: triggeredBy,
	}
}

// finaliseOK stamps a successful outcome onto an in-progress audit.
func finaliseOK(a *domain.ListSyncAudit, status domain.SyncStatus) {
	a.Status = status
	a.FinishedAt = time.Now().UTC()
	a.DurationMS = int(a.FinishedAt.Sub(a.StartedAt).Milliseconds())
}

// finaliseFail stamps a failure outcome with the error string.
func finaliseFail(a *domain.ListSyncAudit, err error) {
	a.Status = domain.SyncStatusFailed
	a.FinishedAt = time.Now().UTC()
	a.DurationMS = int(a.FinishedAt.Sub(a.StartedAt).Milliseconds())
	if err != nil {
		a.Error = err.Error()
	}
}
