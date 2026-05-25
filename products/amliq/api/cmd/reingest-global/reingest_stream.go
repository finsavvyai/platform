package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
)

// reingestStream pipes a StreamParser's output directly into the
// upsert layer in chunks of `batch`. Memory is bounded by `batch`
// regardless of list size, so this is what lets a 600K-row
// OpenSanctions feed fit inside a 2GB pod.
func reingestStream(
	ctx context.Context, d deps, lc domain.ListConfig,
	sp ingestion.StreamParser, batch int,
	audit *domain.ListSyncAudit,
) runStatus {
	audit.FetchStrategy = "stream-disk"

	// FetchToDisk copies the whole response to a temp file first, so
	// downstream throttling can't stall the HTTP socket long enough
	// for upstream CDNs to reset the stream with PROTOCOL_ERROR (the
	// symptom we saw on us-sam-exclusions / opensanctions_peps FTM).
	path, _, err := d.fetcher.FetchToDisk(lc.EffectiveURL())
	if err != nil {
		log.Printf("  fetch error: %v", err)
		ingestion.FinaliseFail(audit, err)
		recordOrLog(ctx, d, *audit)
		return statusFailed
	}
	defer os.Remove(path)
	body, err := os.Open(path)
	if err != nil {
		log.Printf("  open temp error: %v", err)
		ingestion.FinaliseFail(audit, err)
		recordOrLog(ctx, d, *audit)
		return statusFailed
	}
	defer body.Close()

	tid := domain.SystemTenantID()
	flushBuf := make([]domain.Entity, 0, batch)
	var parsed, upserted int
	var coverage coverageAcc

	flush := func() error {
		if len(flushBuf) == 0 {
			return nil
		}
		if err := d.repo.BulkUpsert(ctx, tid, flushBuf); err != nil {
			return fmt.Errorf("bulk upsert: %w", err)
		}
		upserted += len(flushBuf)
		flushBuf = flushBuf[:0]
		return nil
	}

	emit := func(ent domain.Entity) error {
		ent.ListID = lc.ListID
		parsed++
		coverage.observe(&ent)
		flushBuf = append(flushBuf, ent)
		if len(flushBuf) >= batch {
			return flush()
		}
		return nil
	}

	if err := sp.ParseStream(body, emit); err != nil {
		log.Printf("  parse(stream) error: %v", err)
		ingestion.FinaliseFail(audit, fmt.Errorf("parse: %w", err))
		recordOrLog(ctx, d, *audit)
		return statusFailed
	}
	if err := flush(); err != nil {
		log.Printf("  final flush error: %v", err)
		ingestion.FinaliseFail(audit, err)
		recordOrLog(ctx, d, *audit)
		return statusFailed
	}

	audit.EntitiesAfter = upserted
	audit.Delta = upserted
	coverage.applyToAudit(audit)
	logCoverage(audit)
	log.Printf("  streamed %d entities (peak heap bounded)", parsed)

	ingestion.FinaliseOK(audit, domain.SyncStatusOK)
	recordOrLog(ctx, d, *audit)
	return statusOK
}
