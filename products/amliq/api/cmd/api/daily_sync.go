package main

import (
	"context"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

// runDailySync refreshes sanctions lists and search index every 6 hours.
func runDailySync(
	ctx context.Context,
	refreshSvc *ingestion.RefreshService,
	idx *screening.SearchIndex,
	entityRepo storage.EntityRepository,
) {
	if refreshSvc == nil {
		log.Println("daily-sync: no refresh service, disabled")
		return
	}

	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()

	log.Println("daily-sync: scheduled every 6 hours")

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			syncOnce(ctx, refreshSvc, idx, entityRepo)
		}
	}
}

func syncOnce(
	ctx context.Context,
	refreshSvc *ingestion.RefreshService,
	idx *screening.SearchIndex,
	entityRepo storage.EntityRepository,
) {
	log.Println("daily-sync: starting list refresh...")
	start := time.Now()

	if err := refreshSvc.RefreshAll(ctx); err != nil {
		log.Printf("daily-sync: refresh error: %v", err)
	} else {
		log.Printf("daily-sync: lists refreshed in %v", time.Since(start))
	}

	// Rebuild in-memory search index with updated data
	if idx != nil {
		if err := screening.Refresh(idx, entityRepo); err != nil {
			log.Printf("daily-sync: index refresh error: %v", err)
		} else {
			log.Printf("daily-sync: search index rebuilt (%d entities)",
				idx.EntityCount())
		}
	}
}
