package pgx

import (
	"context"
	"database/sql"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type SubscriptionRepository struct {
	db *sql.DB
}

func NewSubscriptionRepository(db *sql.DB) *SubscriptionRepository {
	return &SubscriptionRepository{db: db}
}

func (r *SubscriptionRepository) Create(ctx context.Context, sub domain.Subscription) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO subscriptions (
			id, tenant_id, product, plan_id, lemonsqueezy_id,
			status, seat_count, promo_code,
			current_period_start, current_period_end, cancel_at,
			created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		sub.ID, sub.TenantID, string(sub.Product), sub.PlanID,
		nullString(sub.LemonSqueezyID), string(sub.Status),
		sub.SeatCount, nullString(sub.PromoCode),
		nullTime(sub.CurrentPeriodStart), nullTime(sub.CurrentPeriodEnd),
		sub.CancelAt, sub.CreatedAt, sub.UpdatedAt,
	)
	return err
}

func (r *SubscriptionRepository) GetByTenantID(
	ctx context.Context, tenantID domain.TenantID,
) (*domain.Subscription, error) {
	row := r.db.QueryRowContext(ctx, subSelectSQL+
		` WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`, tenantID.String())
	return scanSubscription(row)
}

func (r *SubscriptionRepository) Update(ctx context.Context, sub domain.Subscription) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE subscriptions SET status=$1, seat_count=$2, promo_code=$3,
		  current_period_start=$4, current_period_end=$5, cancel_at=$6,
		  updated_at=$7 WHERE id=$8`,
		string(sub.Status), sub.SeatCount, nullString(sub.PromoCode),
		nullTime(sub.CurrentPeriodStart), nullTime(sub.CurrentPeriodEnd),
		sub.CancelAt, sub.UpdatedAt, sub.ID,
	)
	return err
}

func (r *SubscriptionRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM subscriptions WHERE id=$1`, id)
	return err
}

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func nullTime(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}
