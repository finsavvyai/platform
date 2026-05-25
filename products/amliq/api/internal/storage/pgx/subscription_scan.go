package pgx

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type subscriptionScanner interface {
	Scan(dest ...interface{}) error
}

func scanSubscription(row subscriptionScanner) (*domain.Subscription, error) {
	var sub domain.Subscription
	var product, status string
	var lsID, promo sql.NullString
	var periodStart, periodEnd sql.NullTime
	var cancelAt *time.Time

	err := row.Scan(
		&sub.ID, &sub.TenantID, &product, &sub.PlanID, &lsID,
		&status, &sub.SeatCount, &promo,
		&periodStart, &periodEnd, &cancelAt,
		&sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("subscription not found")
		}
		return nil, fmt.Errorf("scan subscription: %w", err)
	}

	sub.Product = domain.Product(product)
	sub.Status = domain.SubscriptionStatus(status)
	if lsID.Valid {
		sub.LemonSqueezyID = lsID.String
	}
	if promo.Valid {
		sub.PromoCode = promo.String
	}
	if periodStart.Valid {
		sub.CurrentPeriodStart = periodStart.Time
	}
	if periodEnd.Valid {
		sub.CurrentPeriodEnd = periodEnd.Time
	}
	sub.CancelAt = cancelAt
	return &sub, nil
}

func collectSubscriptions(rows *sql.Rows) ([]domain.Subscription, error) {
	var subs []domain.Subscription
	for rows.Next() {
		sub, err := scanSubscription(rows)
		if err != nil {
			return nil, err
		}
		subs = append(subs, *sub)
	}
	return subs, rows.Err()
}
