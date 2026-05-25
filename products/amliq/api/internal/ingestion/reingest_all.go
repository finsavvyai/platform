package ingestion

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// ReingestOptions narrows the reingest pass.
// When ListID is empty all enabled lists are reingested.
// When TenantID is zero all non-suspended tenants are processed.
type ReingestOptions struct {
	TenantID domain.TenantID
	ListID   string
	DryRun   bool
}

// ReingestAll forces a full re-fetch + re-upsert across all
// tenants × enabled lists, optionally narrowed by ReingestOptions.
// Returns the total number of entities re-parsed.
func (s *RefreshService) ReingestAll(
	ctx context.Context, opts ReingestOptions,
) (int, error) {
	tenants, err := s.tenants.List()
	if err != nil {
		return 0, fmt.Errorf("list tenants: %w", err)
	}

	start := time.Now()
	total, errs := 0, []error{}
	for _, t := range tenants {
		if t.Suspended {
			continue
		}
		if !opts.TenantID.IsZero() && t.ID.String() != opts.TenantID.String() {
			continue
		}
		n, errs2 := s.reingestTenant(ctx, t, opts)
		total += n
		errs = append(errs, errs2...)
	}

	log.Printf("reingest: %d entities in %s, %d errors",
		total, time.Since(start), len(errs))
	if len(errs) > 0 {
		return total, fmt.Errorf("reingest had %d errors; first: %w",
			len(errs), errs[0])
	}
	return total, nil
}

func (s *RefreshService) reingestTenant(
	ctx context.Context, t domain.Tenant, opts ReingestOptions,
) (int, []error) {
	var errs []error
	total := 0
	for _, lc := range t.Config.EnabledLists {
		if !lc.SyncEnabled {
			continue
		}
		if opts.ListID != "" && lc.ListID != opts.ListID {
			continue
		}
		s.limiter.Wait()
		n, err := s.syncSvc.ReingestList(ctx, t.ID, lc, opts.DryRun)
		if err != nil {
			log.Printf("reingest %s/%s: %v", t.ID, lc.ListID, err)
			if s.syncSvc.lmHook != nil {
				s.syncSvc.lmHook.AfterSyncError(ctx, t.ID, lc.ListID, lc.SyncSchedule, err)
			}
			errs = append(errs, err)
			continue
		}
		if s.syncSvc.lmHook != nil {
			s.syncSvc.lmHook.AfterSync(ctx, t.ID, lc.ListID, lc.SyncSchedule)
		}
		total += n
		log.Printf("reingest %s/%s ok (%d entities)", t.ID, lc.ListID, n)
	}
	return total, errs
}
