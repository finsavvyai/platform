package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
)

// runGLEIF iterates GLEIF API pages from startPage for up to maxPages
// and upserts each page into __global__. Rate-limited by pageSleep to
// avoid triggering GLEIF's edge throttling. A single page failure is
// counted and logged; the loop continues so a transient blip doesn't
// lose all subsequent progress.
func runGLEIF(
	ctx context.Context, d deps,
	startPage, pageSize, maxPages int, pageSleep time.Duration,
	jurisdiction string,
) (runStats, error) {
	var s runStats
	tid := domain.SystemTenantID()
	endPage := startPage + maxPages
	for page := startPage; page < endPage; page++ {
		entities, err := fetchAndParsePage(ctx, d, page, pageSize, jurisdiction)
		if err != nil {
			log.Printf("  page %d: %v", page, err)
			s.errors++
			time.Sleep(pageSleep)
			continue
		}
		if len(entities) == 0 {
			log.Printf("  page %d: empty — end of feed", page)
			break
		}
		if err := d.repo.BulkUpsert(ctx, tid, entities); err != nil {
			log.Printf("  page %d: upsert: %v", page, err)
			s.errors++
		} else {
			s.pages++
			s.entities += len(entities)
		}
		if page%10 == 0 {
			log.Printf("  progress: page=%d entities=%d errors=%d",
				page, s.entities, s.errors)
		}
		time.Sleep(pageSleep)
	}
	return s, nil
}

func fetchAndParsePage(
	ctx context.Context, d deps, page, pageSize int,
	jurisdiction string,
) ([]domain.Entity, error) {
	url := ingestion.GLEIFPageURL(page, pageSize)
	if jurisdiction != "" {
		url += "&filter%5Bentity.jurisdiction%5D=" + jurisdiction
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "AMLIQ/2.0 (compliance)")
	resp, err := d.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read: %w", err)
	}
	ents, err := d.parser.Parse(data)
	if err != nil {
		return nil, fmt.Errorf("parse: %w", err)
	}
	return ents, nil
}
