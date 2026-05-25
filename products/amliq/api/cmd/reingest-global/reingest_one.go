package main

import (
	"context"
	"fmt"
	"log"
	"runtime"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
)

// reingestOne runs one list through fetch → parse → upsert and records
// an audit row (+ alerts on failure) via d.recorder. The __global__
// system tenant is used so this shows up alongside regular per-tenant
// refreshes in /admin/list-health.
func reingestOne(
	ctx context.Context, d deps, lc domain.ListConfig,
	batch int, dryRun bool,
) (status runStatus) {
	// GC after each list so memory returns to the OS — critical on
	// 2GB instances where OpenSanctions-scale lists otherwise pin
	// 500MB+ of heap until the next allocation pressure.
	defer runtime.GC()

	tid := domain.SystemTenantID().String()
	audit := ingestion.NewAuditFrom(tid, "reingest-global", lc)

	parser, err := d.tr.Get(lc.ParserType)
	if err != nil {
		log.Printf("  skip: %v", err)
		audit.Status = domain.SyncStatusSkipped
		audit.Error = err.Error()
		finalise(ctx, d, &audit, 0)
		return statusSkipped
	}

	// Fast-path: if the parser supports streaming, pipe fetch →
	// parse → batched upsert without buffering the full entity
	// slice in RAM. Keeps peak heap bounded to ~batch × entity_size.
	if sp, ok := parser.(ingestion.StreamParser); ok && !dryRun {
		return reingestStream(ctx, d, lc, sp, batch, &audit)
	}

	data, _, err := d.fetcher.Fetch(lc.EffectiveURL())
	audit.FetchStrategy = "full"
	audit.SourceBytes = int64(len(data))
	if err != nil {
		log.Printf("  fetch error: %v", err)
		ingestion.FinaliseFail(&audit, err)
		recordOrLog(ctx, d, audit)
		return statusFailed
	}
	log.Printf("  fetched %d bytes", len(data))

	entities, err := parser.Parse(data)
	if err != nil {
		log.Printf("  parse error: %v", err)
		ingestion.FinaliseFail(&audit, fmt.Errorf("parse: %w", err))
		recordOrLog(ctx, d, audit)
		return statusFailed
	}
	// Free the raw bytes as soon as parsing is done — for a 500MB
	// source doc this halves peak RAM during the upsert phase.
	data = nil
	log.Printf("  parsed %d entities", len(entities))
	audit.ComputeCoverage(entities)
	logCoverage(&audit)

	if dryRun || len(entities) == 0 {
		audit.EntitiesAfter = len(entities)
		ingestion.FinaliseOK(&audit, domain.SyncStatusOK)
		recordOrLog(ctx, d, audit)
		return statusOK
	}
	for i := range entities {
		entities[i].ListID = lc.ListID
	}
	if err := upsertBatched(ctx, d.repo, entities, batch); err != nil {
		log.Printf("  upsert error: %v", err)
		ingestion.FinaliseFail(&audit, fmt.Errorf("upsert: %w", err))
		recordOrLog(ctx, d, audit)
		return statusFailed
	}
	audit.EntitiesAfter = len(entities)
	audit.Delta = len(entities)
	ingestion.FinaliseOK(&audit, domain.SyncStatusOK)
	recordOrLog(ctx, d, audit)
	return statusOK
}

// logCoverage prints a per-sync coverage line so admins watching the
// cron output can spot enrichment regressions without hitting the DB.
func logCoverage(a *domain.ListSyncAudit) {
	if a.EntitiesParsed == 0 {
		return
	}
	pct := func(n int) int { return (n * 100) / a.EntitiesParsed }
	log.Printf("  coverage: dob=%d%% nat=%d%% addr=%d%% ids=%d%% alias=%d%%",
		pct(a.EntitiesWithDOB), pct(a.EntitiesWithNat),
		pct(a.EntitiesWithAddr), pct(a.EntitiesWithIDs),
		pct(a.EntitiesWithAliases))
}

// finalise stamps a terminal status (used on skip paths where
// FinaliseOK/Fail don't apply) and records the audit.
func finalise(
	ctx context.Context, d deps, a *domain.ListSyncAudit, entities int,
) {
	a.EntitiesAfter = entities
	ingestion.FinaliseOK(a, a.Status)
	recordOrLog(ctx, d, *a)
}

// recordOrLog persists the audit row, logging any recorder error so the
// reingest job itself isn't aborted by audit infra failures.
func recordOrLog(
	ctx context.Context, d deps, a domain.ListSyncAudit,
) {
	if d.recorder == nil {
		return
	}
	if err := d.recorder.Record(ctx, a); err != nil {
		log.Printf("  audit record failed: %v", err)
	}
}
