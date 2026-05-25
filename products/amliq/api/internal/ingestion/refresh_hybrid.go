package ingestion

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// RefreshMandatoryAndEnabled syncs the mandatory baseline + each
// tenant's opt-in EnabledLists. This is what the daily cron should
// call: regulatory safety net + tenant-admin control.
func (s *RefreshService) RefreshMandatoryAndEnabled(
	ctx context.Context,
) (int, error) {
	tenants, err := s.tenants.List()
	if err != nil {
		return 0, fmt.Errorf("list tenants: %w", err)
	}

	mandatory := MandatoryLists()
	log.Printf("refresh-hybrid: %d mandatory x %d tenants (+ tenant opt-ins)",
		len(mandatory), len(tenants))

	start := time.Now()
	total := 0
	var errs []error

	for _, t := range tenants {
		if t.Suspended {
			continue
		}
		n, e := s.refreshOne(ctx, t, mandatory)
		total += n
		errs = append(errs, e...)
	}

	log.Printf("refresh-hybrid: done in %s, %d ok, %d errors",
		time.Since(start), total, len(errs))
	if len(errs) > 0 {
		return total, fmt.Errorf("%d errors; first: %w", len(errs), errs[0])
	}
	return total, nil
}

func (s *RefreshService) refreshOne(
	ctx context.Context,
	t domain.Tenant,
	mandatory []domain.ListConfig,
) (int, []error) {
	effective := mergeLists(mandatory, t.Config.EnabledLists)
	var errs []error
	ok := 0
	for _, lc := range effective {
		if !lc.SyncEnabled {
			continue
		}
		s.limiter.Wait()
		audit := newAuditFrom(t.ID.String(), "worker-cron", lc)
		result, err := s.syncSvc.SyncListWithStats(ctx, t.ID, lc)
		if err != nil {
			finaliseFail(&audit, err)
			s.recordAudit(ctx, audit)
			log.Printf("refresh-hybrid %s/%s failed: %v", t.ID, lc.ListID, err)
			errs = append(errs, err)
			continue
		}
		result.applyToAudit(&audit)
		status := domain.SyncStatusOK
		if result != nil && result.NotModified {
			status = domain.SyncStatusNotModified
		}
		finaliseOK(&audit, status)
		s.recordAudit(ctx, audit)
		ok++
	}
	return ok, errs
}

// recordAudit delegates to the injected recorder if present.
func (s *RefreshService) recordAudit(
	ctx context.Context, a domain.ListSyncAudit,
) {
	if s.recorder == nil {
		return
	}
	if err := s.recorder.Record(ctx, a); err != nil {
		log.Printf("refresh-hybrid record audit failed: %v", err)
	}
}

