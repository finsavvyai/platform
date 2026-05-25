// Package retention enforces per-tenant data-retention policies.
//
// Day 33 of the production-ready roadmap.
//
// Daily sweep purges rows past their retention window, except where a
// hold_until timestamp pins the row in place (legal hold). Audit logs
// honour the hold; chat / documents / embeddings purge eagerly.
package retention

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Policy is one tenant's retention setting for one data type.
type Policy struct {
	TenantID   uuid.UUID
	DataType   string
	Days       int
	HoldUntil  *time.Time
}

// Purger executes the actual delete for a (tenant, dataType) cohort.
// Production wires per-data-type SQL; tests pass an in-memory fake.
type Purger interface {
	PurgeBefore(ctx context.Context, tenantID uuid.UUID, dataType string, before time.Time) (int, error)
}

// Sweeper drives daily passes.
type Sweeper struct {
	policies func(ctx context.Context) ([]Policy, error)
	purger   Purger
	now      func() time.Time
}

// NewSweeper constructs the sweeper. policiesFn typically queries
// retention_policies (DB-wide, not per-tenant — the daily sweep
// fans out internally).
func NewSweeper(policiesFn func(context.Context) ([]Policy, error), purger Purger) *Sweeper {
	return &Sweeper{policies: policiesFn, purger: purger, now: time.Now}
}

// Sweep runs one pass over every policy. Returns the total rows
// purged across data types and any error encountered (the sweep
// continues past per-policy errors and returns errors.Join).
func (s *Sweeper) Sweep(ctx context.Context) (int, error) {
	policies, err := s.policies(ctx)
	if err != nil {
		return 0, err
	}
	now := s.now()
	total := 0
	var errs []error
	for _, p := range policies {
		if p.HoldUntil != nil && p.HoldUntil.After(now) {
			continue
		}
		before := now.Add(-time.Duration(p.Days) * 24 * time.Hour)
		n, err := s.purger.PurgeBefore(ctx, p.TenantID, p.DataType, before)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		total += n
	}
	return total, errors.Join(errs...)
}
