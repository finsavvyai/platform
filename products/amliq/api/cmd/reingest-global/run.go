package main

import (
	"context"
	"log"
	"sync"
	"sync/atomic"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

type deps struct {
	tr       *ingestion.TypeRegistry
	fetcher  *ingestion.ListFetcher
	repo     *pgx.EntityRepository
	recorder ingestion.SyncRecorder
}

func selectTargets(all bool, listID string) []domain.ListConfig {
	configs := ingestion.AllListConfigs()
	if all {
		return configs
	}
	out := make([]domain.ListConfig, 0, 1)
	for _, lc := range configs {
		if lc.ListID == listID {
			out = append(out, lc)
		}
	}
	return out
}

// runAll iterates every target list with a bounded worker pool.
// Fetches are I/O-bound and dominate wall time, so running several
// lists in parallel gives a near-linear speedup until we hit the
// DB connection ceiling or the remote rate limit.
func runAll(
	ctx context.Context, d deps, targets []domain.ListConfig,
	batch, concurrency int, dryRun bool,
) (int, int, int) {
	if concurrency < 1 {
		concurrency = 1
	}
	var ok, skipped, failed atomic.Int64

	jobs := make(chan job, len(targets))
	var wg sync.WaitGroup
	for w := 0; w < concurrency; w++ {
		wg.Add(1)
		go worker(ctx, d, batch, dryRun, jobs, &ok, &skipped, &failed, &wg)
	}
	for i, lc := range targets {
		jobs <- job{index: i, total: len(targets), lc: lc}
	}
	close(jobs)
	wg.Wait()
	return int(ok.Load()), int(skipped.Load()), int(failed.Load())
}

type job struct {
	index, total int
	lc           domain.ListConfig
}

func worker(
	ctx context.Context, d deps, batch int, dryRun bool,
	jobs <-chan job, ok, skipped, failed *atomic.Int64,
	wg *sync.WaitGroup,
) {
	defer wg.Done()
	for j := range jobs {
		log.Printf("[%d/%d] %s (%s)", j.index+1, j.total, j.lc.ListID, j.lc.ParserType)
		switch reingestOne(ctx, d, j.lc, batch, dryRun) {
		case statusOK:
			ok.Add(1)
		case statusSkipped:
			skipped.Add(1)
		case statusFailed:
			failed.Add(1)
		}
	}
}

type runStatus int

const (
	statusOK runStatus = iota
	statusSkipped
	statusFailed
)
