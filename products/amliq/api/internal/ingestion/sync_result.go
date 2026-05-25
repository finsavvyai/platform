package ingestion

import "github.com/aegis-aml/aegis/internal/domain"

// SyncResult captures per-sync observability data that SyncList-style
// callers can feed into ListSyncAudit. Nil means the sync short-
// circuited (e.g. ETag 304) and no fresh parse happened.
type SyncResult struct {
	NotModified    bool
	SourceBytes    int
	ParsedEntities int
	Coverage       coverageCounts
}

type coverageCounts struct {
	DOB     int
	Nat     int
	Addr    int
	IDs     int
	Aliases int
}

// countCoverage tallies enrichment-field coverage across a slice of
// parsed entities. Mirrors ListSyncAudit.ComputeCoverage but lives
// in the ingestion package so streaming callers can reuse it.
func countCoverage(entities []domain.Entity) coverageCounts {
	var c coverageCounts
	for _, e := range entities {
		if e.DOB != nil {
			c.DOB++
		}
		if len(e.Nationalities) > 0 {
			c.Nat++
		}
		if len(e.Addresses) > 0 {
			c.Addr++
		}
		if len(e.Identifiers) > 0 {
			c.IDs++
		}
		if len(e.Names) > 1 {
			c.Aliases++
		}
	}
	return c
}

// applyToAudit copies a SyncResult's counters onto an audit row.
// Safe to call with r == nil; leaves the audit untouched in that
// case (useful for short-circuit paths like 304-not-modified).
func (r *SyncResult) applyToAudit(a *domain.ListSyncAudit) {
	if r == nil {
		return
	}
	a.EntitiesParsed = r.ParsedEntities
	a.EntitiesWithDOB = r.Coverage.DOB
	a.EntitiesWithNat = r.Coverage.Nat
	a.EntitiesWithAddr = r.Coverage.Addr
	a.EntitiesWithIDs = r.Coverage.IDs
	a.EntitiesWithAliases = r.Coverage.Aliases
	if r.SourceBytes > 0 {
		a.SourceBytes = int64(r.SourceBytes)
	}
}
