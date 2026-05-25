package pgx

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ListSyncAuditRepo is the database/sql-backed persistence for
// list_sync_audit rows. Alerting fan-out sits in a separate wrapper
// so tests can exercise persistence in isolation.
type ListSyncAuditRepo struct{ db *sql.DB }

// NewListSyncAuditRepo constructs the repo.
func NewListSyncAuditRepo(db *sql.DB) *ListSyncAuditRepo {
	return &ListSyncAuditRepo{db: db}
}

// Insert persists one audit row. Id is populated on return.
func (r *ListSyncAuditRepo) Insert(
	ctx context.Context, a domain.ListSyncAudit,
) (int64, error) {
	var id int64
	err := r.db.QueryRowContext(ctx, `
        INSERT INTO list_sync_audit (
            tenant_id, list_id, status, started_at, finished_at,
            duration_ms, entities_before, entities_after, delta,
            fetch_strategy, source_bytes, error, triggered_by,
            entities_parsed, entities_with_dob, entities_with_nat,
            entities_with_addr, entities_with_ids, entities_with_aliases)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
                $14,$15,$16,$17,$18,$19)
        RETURNING id`,
		a.TenantID, a.ListID, string(a.Status),
		a.StartedAt, nullTime(a.FinishedAt),
		a.DurationMS, a.EntitiesBefore, a.EntitiesAfter, a.Delta,
		a.FetchStrategy, a.SourceBytes, a.Error, a.TriggeredBy,
		a.EntitiesParsed, a.EntitiesWithDOB, a.EntitiesWithNat,
		a.EntitiesWithAddr, a.EntitiesWithIDs, a.EntitiesWithAliases,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("insert list_sync_audit: %w", err)
	}
	return id, nil
}

// Record satisfies ingestion.SyncRecorder — persistence only.
func (r *ListSyncAuditRepo) Record(
	ctx context.Context, a domain.ListSyncAudit,
) error {
	_, err := r.Insert(ctx, a)
	return err
}
