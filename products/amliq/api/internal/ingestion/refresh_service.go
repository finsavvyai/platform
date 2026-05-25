package ingestion

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// TenantLister retrieves all tenants for bulk refresh.
type TenantLister interface {
	List() ([]domain.Tenant, error)
}

// RefreshService orchestrates daily refresh of all sanctions lists
// across all tenants with rate limiting between downloads.
type RefreshService struct {
	syncSvc  *SyncService
	tenants  TenantLister
	limiter  *DownloadLimiter
	recorder SyncRecorder // optional; nil disables audit
}

// WithRecorder attaches a SyncRecorder so every SyncList call in
// RefreshMandatoryAndEnabled is persisted + optionally alerted on.
func (s *RefreshService) WithRecorder(r SyncRecorder) *RefreshService {
	s.recorder = r
	return s
}

// NewRefreshService creates a refresh service with rate limiting.
func NewRefreshService(
	syncSvc *SyncService,
	tenants TenantLister,
	limiter *DownloadLimiter,
) *RefreshService {
	return &RefreshService{
		syncSvc: syncSvc,
		tenants: tenants,
		limiter: limiter,
	}
}

// RefreshAll downloads and upserts all enabled lists for all tenants.
func (s *RefreshService) RefreshAll(ctx context.Context) error {
	tenants, err := s.tenants.List()
	if err != nil {
		return fmt.Errorf("list tenants: %w", err)
	}

	log.Printf("refresh: starting for %d tenants", len(tenants))
	start := time.Now()
	var errors []error

	for _, tenant := range tenants {
		if tenant.Suspended {
			continue
		}
		errs := s.refreshTenant(ctx, tenant)
		errors = append(errors, errs...)
	}

	elapsed := time.Since(start)
	log.Printf("refresh: completed in %s, %d errors", elapsed, len(errors))

	if len(errors) > 0 {
		return fmt.Errorf("refresh had %d errors; first: %w", len(errors), errors[0])
	}
	return nil
}

// refreshTenant syncs all enabled lists for a single tenant.
func (s *RefreshService) refreshTenant(
	ctx context.Context, tenant domain.Tenant,
) []error {
	var errors []error
	for _, lc := range tenant.Config.EnabledLists {
		if !lc.SyncEnabled {
			continue
		}
		s.limiter.Wait()
		if err := s.syncSvc.SyncList(ctx, tenant.ID, lc); err != nil {
			log.Printf("refresh %s/%s failed: %v", tenant.ID, lc.ListID, err)
			if s.syncSvc.lmHook != nil {
				s.syncSvc.lmHook.AfterSyncError(ctx, tenant.ID, lc.ListID, lc.SyncSchedule, err)
			}
			errors = append(errors, err)
			continue
		}
		if s.syncSvc.lmHook != nil {
			s.syncSvc.lmHook.AfterSync(ctx, tenant.ID, lc.ListID, lc.SyncSchedule)
		}
		log.Printf("refresh %s/%s ok", tenant.ID, lc.ListID)
	}
	return errors
}
