package pgx

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

type BillingEventRepository struct {
	db *sql.DB
}

func NewBillingEventRepository(db *sql.DB) *BillingEventRepository {
	return &BillingEventRepository{db: db}
}

func (r *BillingEventRepository) Append(ctx context.Context, evt domain.BillingEvent) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO billing_events (id, event_type, tenant_id, payload, created_at)
		VALUES ($1, $2, $3, $4, $5)`,
		evt.ID, string(evt.Type), evt.TenantID.String(),
		evt.Payload, evt.CreatedAt,
	)
	return err
}

func (r *BillingEventRepository) GetByID(
	ctx context.Context, id string,
) (*domain.BillingEvent, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, event_type, tenant_id, payload, created_at
		FROM billing_events WHERE id=$1`, id)
	return scanBillingEvent(row)
}

func (r *BillingEventRepository) ListByTenantID(
	ctx context.Context, tenantID domain.TenantID, limit int,
) ([]domain.BillingEvent, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, event_type, tenant_id, payload, created_at
		FROM billing_events WHERE tenant_id=$1
		ORDER BY created_at DESC LIMIT $2`,
		tenantID.String(), limit)
	if err != nil {
		return nil, fmt.Errorf("list billing events: %w", err)
	}
	defer rows.Close()
	return collectBillingEvents(rows)
}
