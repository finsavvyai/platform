package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
)

type subscriptionRepository struct {
	db *pgxpool.Pool
}

// NewSubscriptionRepository creates a new postgres subscription repository
func NewSubscriptionRepository(db *pgxpool.Pool) repositories.SubscriptionRepository {
	return &subscriptionRepository{
		db: db,
	}
}

func (r *subscriptionRepository) Create(ctx context.Context, s *entities.Subscription) error {
	query := `
		INSERT INTO subscriptions (
			id, user_id, customer_id, store_id, order_id, product_id, variant_id,
			status, plan_type, trial_ends_at, renews_at, ends_at, cancelled_at,
			cancellation_reason, usage_limit, current_usage, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
		)
	`
	_, err := r.db.Exec(ctx, query,
		s.ID, s.UserID, s.CustomerID, s.StoreID, s.OrderID, s.ProductID, s.VariantID,
		s.Status, s.PlanType, s.TrialEndsAt, s.RenewsAt, s.EndsAt, s.CancelledAt,
		s.CancellationReason, s.UsageLimit, s.CurrentUsage, s.CreatedAt, s.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create subscription: %w", err)
	}
	return nil
}

func (r *subscriptionRepository) GetByID(ctx context.Context, id string) (*entities.Subscription, error) {
	query := `SELECT * FROM subscriptions WHERE id = $1`
	return r.scanSubscription(r.db.QueryRow(ctx, query, id))
}

func (r *subscriptionRepository) GetByUserID(ctx context.Context, userID string) (*entities.Subscription, error) {
	query := `SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`
	return r.scanSubscription(r.db.QueryRow(ctx, query, userID))
}

func (r *subscriptionRepository) GetByCustomerID(ctx context.Context, customerID string) (*entities.Subscription, error) {
	query := `SELECT * FROM subscriptions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`
	return r.scanSubscription(r.db.QueryRow(ctx, query, customerID))
}

func (r *subscriptionRepository) GetByLemonSqueezyID(ctx context.Context, lemonSqueezyID string) (*entities.Subscription, error) {
	// Assuming order_id or another field stores the Lemon Squeezy ID if not explicitly named
	query := `SELECT * FROM subscriptions WHERE order_id = $1 OR customer_id = $1 LIMIT 1`
	return r.scanSubscription(r.db.QueryRow(ctx, query, lemonSqueezyID))
}

func (r *subscriptionRepository) Update(ctx context.Context, s *entities.Subscription) error {
	query := `
		UPDATE subscriptions SET
			status = $1, plan_type = $2, trial_ends_at = $3, renews_at = $4,
			ends_at = $5, cancelled_at = $6, cancellation_reason = $7,
			usage_limit = $8, current_usage = $9, updated_at = $10
		WHERE id = $11
	`
	_, err := r.db.Exec(ctx, query,
		s.Status, s.PlanType, s.TrialEndsAt, s.RenewsAt, s.EndsAt, s.CancelledAt,
		s.CancellationReason, s.UsageLimit, s.CurrentUsage, time.Now(), s.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}
	return nil
}

func (r *subscriptionRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM subscriptions WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *subscriptionRepository) UpdateStatus(ctx context.Context, id, status string) error {
	query := `UPDATE subscriptions SET status = $1, updated_at = $2 WHERE id = $3`
	_, err := r.db.Exec(ctx, query, status, time.Now(), id)
	return err
}

func (r *subscriptionRepository) IncrementUsage(ctx context.Context, id string) error {
	query := `UPDATE subscriptions SET current_usage = current_usage + 1, updated_at = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, time.Now(), id)
	return err
}

func (r *subscriptionRepository) ResetUsage(ctx context.Context, id string) error {
	query := `UPDATE subscriptions SET current_usage = 0, updated_at = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, time.Now(), id)
	return err
}

func (r *subscriptionRepository) GetActiveSubscriptions(ctx context.Context) ([]*entities.Subscription, error) {
	query := `SELECT * FROM subscriptions WHERE status IN ('active', 'on_trial')`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []*entities.Subscription
	for rows.Next() {
		s, err := r.scanSubscription(rows)
		if err != nil {
			return nil, err
		}
		subs = append(subs, s)
	}
	return subs, nil
}

func (r *subscriptionRepository) GetExpiringSubscriptions(ctx context.Context, days int) ([]*entities.Subscription, error) {
	query := `SELECT * FROM subscriptions WHERE status IN ('active', 'on_trial') AND renews_at <= $1`
	expiryDate := time.Now().AddDate(0, 0, days)
	rows, err := r.db.Query(ctx, query, expiryDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []*entities.Subscription
	for rows.Next() {
		s, err := r.scanSubscription(rows)
		if err != nil {
			return nil, err
		}
		subs = append(subs, s)
	}
	return subs, nil
}

func (r *subscriptionRepository) ListByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.Subscription, error) {
	query := `SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []*entities.Subscription
	for rows.Next() {
		s, err := r.scanSubscription(rows)
		if err != nil {
			return nil, err
		}
		subs = append(subs, s)
	}
	return subs, nil
}

func (r *subscriptionRepository) CountByUser(ctx context.Context, userID string) (int, error) {
	query := `SELECT COUNT(*) FROM subscriptions WHERE user_id = $1`
	var count int
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	return count, err
}

func (r *subscriptionRepository) scanSubscription(row interface{ Scan(dest ...any) error }) (*entities.Subscription, error) {
	var s entities.Subscription
	err := row.Scan(
		&s.ID, &s.UserID, &s.CustomerID, &s.StoreID, &s.OrderID, &s.ProductID, &s.VariantID,
		&s.Status, &s.PlanType, &s.TrialEndsAt, &s.RenewsAt, &s.EndsAt, &s.CancelledAt,
		&s.CancellationReason, &s.UsageLimit, &s.CurrentUsage, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}
