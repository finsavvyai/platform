package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// SaveOAuthState persists an expiring OAuth state token.
func (s *DB) SaveOAuthState(state, provider string, expiresAt time.Time) error {
	_, err := s.db.Exec(
		s.bind(`INSERT INTO oauth_states (state, provider, expires_at, created_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(state) DO UPDATE SET provider = excluded.provider, expires_at = excluded.expires_at`),
		state, provider, expiresAt.UTC(), time.Now().UTC(),
	)
	return err
}

// ConsumeOAuthState validates and removes an OAuth state token.
func (s *DB) ConsumeOAuthState(state, provider string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck

	var expiresAt time.Time
	err = tx.QueryRow(
		s.bind(`SELECT expires_at FROM oauth_states WHERE state = ? AND provider = ?`),
		state, provider,
	).Scan(&expiresAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("invalid or expired state")
		}
		return err
	}
	if time.Now().UTC().After(expiresAt.UTC()) {
		_, _ = tx.Exec(s.bind(`DELETE FROM oauth_states WHERE state = ?`), state)
		return fmt.Errorf("invalid or expired state")
	}
	if _, err := tx.Exec(s.bind(`DELETE FROM oauth_states WHERE state = ? AND provider = ?`), state, provider); err != nil {
		return err
	}
	return tx.Commit()
}

// UpsertSubscription stores billing state for a tenant.
func (s *DB) UpsertSubscription(rec *SubscriptionRecord) error {
	now := time.Now().UTC()
	if rec.CreatedAt.IsZero() {
		rec.CreatedAt = now
	}
	rec.UpdatedAt = now

	_, err := s.db.Exec(
		s.bind(`INSERT INTO subscriptions (tenant_id, tier, status, subscription_id, customer_id, renews_at, cancelled_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(tenant_id) DO UPDATE SET
				tier = excluded.tier,
				status = excluded.status,
				subscription_id = excluded.subscription_id,
				customer_id = excluded.customer_id,
				renews_at = excluded.renews_at,
				cancelled_at = excluded.cancelled_at,
				updated_at = excluded.updated_at`),
		rec.TenantID, rec.Tier, rec.Status, rec.SubscriptionID, rec.CustomerID, rec.RenewsAt, rec.CancelledAt, rec.CreatedAt, rec.UpdatedAt,
	)
	return err
}

// GetSubscription returns billing state for a tenant, if any.
func (s *DB) GetSubscription(tenantID string) (*SubscriptionRecord, error) {
	var (
		rec         SubscriptionRecord
		renewsAt    sql.NullTime
		cancelledAt sql.NullTime
	)
	err := s.db.QueryRow(
		s.bind(`SELECT tenant_id, tier, status, subscription_id, customer_id, renews_at, cancelled_at, created_at, updated_at
			FROM subscriptions WHERE tenant_id = ?`),
		tenantID,
	).Scan(&rec.TenantID, &rec.Tier, &rec.Status, &rec.SubscriptionID, &rec.CustomerID, &renewsAt, &cancelledAt, &rec.CreatedAt, &rec.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("subscription not found")
		}
		return nil, err
	}
	if renewsAt.Valid {
		rec.RenewsAt = &renewsAt.Time
	}
	if cancelledAt.Valid {
		rec.CancelledAt = &cancelledAt.Time
	}
	return &rec, nil
}
