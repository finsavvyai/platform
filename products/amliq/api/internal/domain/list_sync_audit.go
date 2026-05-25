package domain

import "time"

// SyncStatus enumerates terminal outcomes of a list sync attempt.
type SyncStatus string

const (
	SyncStatusOK          SyncStatus = "ok"
	SyncStatusFailed      SyncStatus = "failed"
	SyncStatusSkipped     SyncStatus = "skipped"
	SyncStatusNotModified SyncStatus = "not_modified"
)

// IsFailure returns true for statuses admins should be alerted on.
func (s SyncStatus) IsFailure() bool {
	return s == SyncStatusFailed
}

// ListSyncAudit is one append-only row per SyncList invocation.
// Populated by the refresh pipeline (daily worker, manual refresh,
// reingest-global cron). Read by the /admin/list-health page and the
// alerter.
type ListSyncAudit struct {
	ID             int64
	TenantID       string
	ListID         string
	Status         SyncStatus
	StartedAt      time.Time
	FinishedAt     time.Time
	DurationMS     int
	EntitiesBefore int
	EntitiesAfter  int
	Delta          int
	FetchStrategy  string
	SourceBytes    int64
	Error          string
	TriggeredBy    string

	// Field coverage stats — populated by ComputeCoverage.
	// Lets admins detect parser regressions where the source still
	// returns data but the parser stops emitting enrichment fields.
	EntitiesParsed       int
	EntitiesWithDOB      int
	EntitiesWithNat      int
	EntitiesWithAddr     int
	EntitiesWithIDs      int
	EntitiesWithAliases  int
}

// ComputeCoverage walks the parsed entities and fills the coverage
// fields. An entity "has aliases" when it has more than one Name.
func (a *ListSyncAudit) ComputeCoverage(entities []Entity) {
	a.EntitiesParsed = len(entities)
	for _, e := range entities {
		if e.DOB != nil {
			a.EntitiesWithDOB++
		}
		if len(e.Nationalities) > 0 {
			a.EntitiesWithNat++
		}
		if len(e.Addresses) > 0 {
			a.EntitiesWithAddr++
		}
		if len(e.Identifiers) > 0 {
			a.EntitiesWithIDs++
		}
		if len(e.Names) > 1 {
			a.EntitiesWithAliases++
		}
	}
}
