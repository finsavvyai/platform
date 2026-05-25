// Background sweeper that revokes API keys past their grace window
// or hard expiry. Runs every interval; idempotent — running twice in
// a row is a no-op once the keys are revoked.
//
// Day 9 of the production-ready roadmap.
package auth

import (
	"context"
	"database/sql"
	"log/slog"
	"time"
)

// Sweeper revokes expired or rotated-past-grace API keys.
type Sweeper struct {
	db       *sql.DB
	logger   *slog.Logger
	interval time.Duration
	now      func() time.Time
}

// NewSweeper wires a Sweeper. interval is the period between sweeps.
// Use 5 minutes in production; tests override via the now() hook.
func NewSweeper(db *sql.DB, logger *slog.Logger, interval time.Duration) *Sweeper {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Sweeper{db: db, logger: logger, interval: interval, now: time.Now}
}

// Run blocks until ctx is cancelled, sweeping every Interval. Returns
// the ctx error on shutdown so the caller can wait/restart cleanly.
func (s *Sweeper) Run(ctx context.Context) error {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	// First tick immediately so callers don't have to wait one interval
	// to see the sweeper do its job.
	if err := s.Sweep(ctx); err != nil {
		s.logger.Warn("sweeper initial pass failed", slog.Any("err", err))
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := s.Sweep(ctx); err != nil {
				s.logger.Warn("sweeper pass failed", slog.Any("err", err))
			}
		}
	}
}

// Sweep is one pass: revoke any key whose expires_at <= now AND not
// already revoked. Returns the number of keys revoked.
func (s *Sweeper) Sweep(ctx context.Context) error {
	now := s.now()
	res, err := s.db.ExecContext(ctx,
		`UPDATE api_keys
		    SET is_active = false, revoked_at = $1, updated_at = $1
		  WHERE expires_at IS NOT NULL
		    AND expires_at <= $1
		    AND revoked_at IS NULL`,
		now,
	)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows > 0 {
		s.logger.Info("sweeper revoked keys",
			slog.Int64("count", rows),
			slog.Time("at", now),
		)
	}
	return nil
}
