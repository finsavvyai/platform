package api

import (
	"sort"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// buildAIUsageReport filters AISummarized entries within [since, until]
// and groups them by actor. Entries outside the window or for other
// actions are skipped. Result is deterministic-sorted by ActorID so
// the UI can paginate without surprise reordering.
func buildAIUsageReport(entries []domain.AuditEntry, since, until time.Time) AIUsageResponse {
	byActor := map[string]*AIUsageEntry{}
	total := 0
	for _, e := range entries {
		if e.Action != domain.AuditActionAISummarized {
			continue
		}
		if e.Timestamp.Before(since) || e.Timestamp.After(until) {
			continue
		}
		bumpUsageEntry(byActor, e)
		total++
	}
	members := make([]AIUsageEntry, 0, len(byActor))
	for _, v := range byActor {
		members = append(members, *v)
	}
	sort.Slice(members, func(i, j int) bool {
		return members[i].ActorID < members[j].ActorID
	})
	return AIUsageResponse{
		Since: since, Until: until,
		Members: members, TotalCalls: total,
	}
}

// bumpUsageEntry increments the per-actor counter and breaks out the
// summary type. Type is read from the audit Details map (set by
// writeAIAudit at write time); missing or non-string falls back to
// "unknown" so we don't drop the call from the count.
func bumpUsageEntry(byActor map[string]*AIUsageEntry, e domain.AuditEntry) {
	cur := byActor[e.ActorID]
	if cur == nil {
		cur = &AIUsageEntry{
			ActorID:      e.ActorID,
			SummaryTypes: map[string]int{},
		}
		byActor[e.ActorID] = cur
	}
	cur.AICallCount++
	if e.Timestamp.After(cur.LastCallAt) {
		cur.LastCallAt = e.Timestamp
	}
	st, _ := e.Details["summary_type"].(string)
	if st == "" {
		st = "unknown"
	}
	cur.SummaryTypes[st]++
}
