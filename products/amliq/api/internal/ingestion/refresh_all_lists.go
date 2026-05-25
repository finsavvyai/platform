package ingestion

import (
	"context"
	"fmt"
	"log"
	"time"
)

// RefreshAllLists downloads ALL major sanctions lists for every active
// tenant, regardless of tenant EnabledLists configuration. Returns
// total list-tenant syncs completed.
func (s *RefreshService) RefreshAllLists(ctx context.Context) (int, error) {
	tenants, err := s.tenants.List()
	if err != nil {
		return 0, fmt.Errorf("list tenants: %w", err)
	}

	lists := AllMajorLists()
	log.Printf("refresh-all: %d lists x %d tenants",
		len(lists), len(tenants))

	start := time.Now()
	total := 0
	var errors []error

	for _, lc := range lists {
		s.limiter.Wait()
		for _, tenant := range tenants {
			if tenant.Suspended {
				continue
			}
			if err := s.syncSvc.SyncList(ctx, tenant.ID, lc); err != nil {
				log.Printf("refresh-all %s/%s failed: %v",
					tenant.ID, lc.ListID, err)
				errors = append(errors, err)
				continue
			}
			total++
			log.Printf("refresh-all %s/%s ok", tenant.ID, lc.ListID)
		}
	}

	elapsed := time.Since(start)
	log.Printf("refresh-all: done in %s, %d ok, %d errors",
		elapsed, total, len(errors))

	if len(errors) > 0 {
		return total, fmt.Errorf("%d errors; first: %w",
			len(errors), errors[0])
	}
	return total, nil
}
