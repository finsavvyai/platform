package pgx

import (
	"context"
	"database/sql"
	"encoding/json"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EntityHistoryRepo tracks entity changes over time.
type EntityHistoryRepo struct {
	db *sql.DB
}

func NewEntityHistoryRepo(db *sql.DB) *EntityHistoryRepo {
	return &EntityHistoryRepo{db: db}
}

// RecordChange logs an entity addition, update, or removal.
func (r *EntityHistoryRepo) RecordChange(
	ctx context.Context,
	entity domain.Entity,
	tenantID domain.TenantID,
	changeType string,
) error {
	snapshot, _ := json.Marshal(entity)
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO entity_history
		(entity_id, tenant_id, list_id, full_name, change_type, snapshot)
		VALUES ($1, $2, $3, $4, $5, $6)
	`,
		entity.ID.String(),
		tenantID.String(),
		entity.ListID,
		entity.PrimaryName().Full,
		changeType,
		snapshot,
	)
	return err
}

// GetEntityHistory returns change history for an entity.
func (r *EntityHistoryRepo) GetEntityHistory(
	ctx context.Context, entityID string, limit int,
) ([]EntityChange, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT entity_id, list_id, full_name, change_type,
		       changed_at, snapshot
		FROM entity_history
		WHERE entity_id = $1
		ORDER BY changed_at DESC
		LIMIT $2
	`, entityID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanChanges(rows)
}

// GetRemovedEntities returns recently removed entities.
func (r *EntityHistoryRepo) GetRemovedEntities(
	ctx context.Context, listID string, limit int,
) ([]EntityChange, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT entity_id, list_id, full_name, change_type,
		       changed_at, snapshot
		FROM entity_history
		WHERE change_type = 'removed'
		  AND ($1 = '' OR list_id = $1)
		ORDER BY changed_at DESC
		LIMIT $2
	`, listID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanChanges(rows)
}

// EntityChange represents a single change event.
type EntityChange struct {
	EntityID   string          `json:"entity_id"`
	ListID     string          `json:"list_id"`
	FullName   string          `json:"full_name"`
	ChangeType string          `json:"change_type"`
	ChangedAt  string          `json:"changed_at"`
	Snapshot   json.RawMessage `json:"snapshot,omitempty"`
}

func scanChanges(rows *sql.Rows) ([]EntityChange, error) {
	var changes []EntityChange
	for rows.Next() {
		var c EntityChange
		var changedAt sql.NullTime
		if err := rows.Scan(
			&c.EntityID, &c.ListID, &c.FullName,
			&c.ChangeType, &changedAt, &c.Snapshot,
		); err != nil {
			return nil, err
		}
		if changedAt.Valid {
			c.ChangedAt = changedAt.Time.Format("2006-01-02T15:04:05Z")
		}
		changes = append(changes, c)
	}
	return changes, rows.Err()
}
