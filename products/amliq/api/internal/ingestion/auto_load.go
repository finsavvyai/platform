package ingestion

import (
	"context"
	"database/sql"
	"fmt"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
)

// AutoLoader seeds sanctions data on first startup when the entities
// table is empty. It downloads all major lists for every active tenant.
type AutoLoader struct {
	db      *sql.DB
	syncSvc *SyncService
	tenants TenantLister
	limiter *DownloadLimiter
}

// NewAutoLoader creates an auto-loader with the given dependencies.
func NewAutoLoader(
	db *sql.DB,
	syncSvc *SyncService,
	tenants TenantLister,
	limiter *DownloadLimiter,
) *AutoLoader {
	return &AutoLoader{
		db:      db,
		syncSvc: syncSvc,
		tenants: tenants,
		limiter: limiter,
	}
}

// IsEmpty returns true when the entities table has zero rows.
func (al *AutoLoader) IsEmpty(ctx context.Context) (bool, error) {
	count, err := al.EntityCount(ctx)
	if err != nil {
		return false, err
	}
	return count == 0, nil
}

// EntityCount returns the number of entities in the database.
func (al *AutoLoader) EntityCount(ctx context.Context) (int, error) {
	var count int
	err := al.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM entities").Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count entities: %w", err)
	}
	return count, nil
}

// LoadAll downloads and upserts all major sanctions lists for every
// active tenant. Returns total entities loaded across all tenants.
func (al *AutoLoader) LoadAll(ctx context.Context) (int, error) {
	tenants, err := al.tenants.List()
	if err != nil {
		return 0, fmt.Errorf("list tenants: %w", err)
	}
	if len(tenants) == 0 {
		log.Println("auto-load: no tenants found, skipping")
		return 0, nil
	}

	lists := AllMajorLists()
	total := 0

	for _, lc := range lists {
		al.limiter.Wait()
		for _, tenant := range tenants {
			if tenant.Suspended {
				continue
			}
			if err := al.syncOne(ctx, tenant.ID, lc); err != nil {
				log.Printf("auto-load %s/%s error: %v",
					tenant.ID, lc.ListID, err)
				continue
			}
			total++
		}
	}
	return total, nil
}

func (al *AutoLoader) syncOne(
	ctx context.Context,
	tenantID domain.TenantID,
	lc domain.ListConfig,
) error {
	log.Printf("auto-load: syncing %s for tenant %s", lc.ListID, tenantID)
	if err := al.syncSvc.SyncList(ctx, tenantID, lc); err != nil {
		return err
	}
	log.Printf("auto-load: %s/%s complete", tenantID, lc.ListID)
	return nil
}
