package pgx

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

const subSelectSQL = `
	SELECT id, tenant_id, product, plan_id, lemonsqueezy_id,
	       status, seat_count, promo_code,
	       current_period_start, current_period_end, cancel_at,
	       created_at, updated_at
	FROM subscriptions`

func (r *SubscriptionRepository) GetByLemonSqueezyID(
	ctx context.Context, lsID string,
) (*domain.Subscription, error) {
	row := r.db.QueryRowContext(ctx, subSelectSQL+` WHERE lemonsqueezy_id = $1`, lsID)
	return scanSubscription(row)
}

func (r *SubscriptionRepository) ListByTenantID(
	ctx context.Context, tenantID domain.TenantID,
) ([]domain.Subscription, error) {
	rows, err := r.db.QueryContext(ctx,
		subSelectSQL+` WHERE tenant_id=$1 ORDER BY created_at DESC`,
		tenantID.String())
	if err != nil {
		return nil, fmt.Errorf("list subscriptions: %w", err)
	}
	defer rows.Close()
	return collectSubscriptions(rows)
}
