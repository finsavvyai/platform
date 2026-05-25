package audit

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

// MemoryStore is a concurrency-safe, in-memory AuditRepository for
// development and testing. It enforces strict tenant isolation.
type MemoryStore struct {
	mu      sync.RWMutex
	entries map[string]*AuditEntry // keyed by entry ID
	seq     int
}

// NewMemoryStore returns a ready-to-use in-memory audit store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{entries: make(map[string]*AuditEntry)}
}

// Insert adds a new audit entry, assigning an ID if empty.
func (m *MemoryStore) Insert(_ context.Context, entry *AuditEntry) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if entry.ID == "" {
		m.seq++
		entry.ID = fmt.Sprintf("audit-%d", m.seq)
	}
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now().UTC()
	}
	cp := *entry
	cp.Details = copyDetails(entry.Details)
	m.entries[cp.ID] = &cp
	return nil
}

// GetByID returns a single entry with tenant isolation.
func (m *MemoryStore) GetByID(_ context.Context, tenantID, entryID string) (*AuditEntry, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	e, ok := m.entries[entryID]
	if !ok || e.TenantID != tenantID {
		return nil, ErrEntryNotFound
	}
	cp := *e
	return &cp, nil
}

// List returns filtered, sorted, cursor-paginated audit entries.
func (m *MemoryStore) List(_ context.Context, q AuditQuery) ([]AuditEntry, string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var matched []AuditEntry
	for _, e := range m.entries {
		if e.TenantID != q.TenantID {
			continue
		}
		if !matchesFilter(e, &q.Filters) {
			continue
		}
		matched = append(matched, *e)
	}

	sortEntries(matched, q.SortOrder)

	// Cursor-based pagination: cursor is the entry ID after which we start.
	start := 0
	if q.Cursor != "" {
		for i, e := range matched {
			if e.ID == q.Cursor {
				start = i + 1
				break
			}
		}
	}
	if start >= len(matched) {
		return []AuditEntry{}, "", nil
	}

	end := start + q.Limit
	if end > len(matched) {
		end = len(matched)
	}
	page := matched[start:end]

	var nextCursor string
	if end < len(matched) {
		nextCursor = page[len(page)-1].ID
	}
	return page, nextCursor, nil
}

// GetStats aggregates statistics for a tenant with optional time filter.
func (m *MemoryStore) GetStats(_ context.Context, tenantID string, f AuditFilter) (*AuditStats, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := &AuditStats{ActionCounts: make(map[ActionType]int)}
	actors := make(map[string]struct{})
	resources := make(map[string]int)

	for _, e := range m.entries {
		if e.TenantID != tenantID {
			continue
		}
		if !matchesTimeRange(e, f.From, f.To) {
			continue
		}
		stats.TotalEvents++
		actors[e.ActorID] = struct{}{}
		stats.ActionCounts[e.Action]++
		resources[e.Resource]++
	}
	stats.UniqueActors = len(actors)
	stats.TopAction = topAction(stats.ActionCounts)
	stats.TopResource = topResource(resources)
	return stats, nil
}

// --- helpers ---

func matchesFilter(e *AuditEntry, f *AuditFilter) bool {
	if f.Actor != "" && e.ActorID != f.Actor {
		return false
	}
	if f.Action != "" && e.Action != f.Action {
		return false
	}
	if f.Resource != "" && e.Resource != f.Resource {
		return false
	}
	if !matchesTimeRange(e, f.From, f.To) {
		return false
	}
	if f.Keyword != "" && !keywordInDetails(e, f.Keyword) {
		return false
	}
	return true
}

func matchesTimeRange(e *AuditEntry, from, to *time.Time) bool {
	if from != nil && e.Timestamp.Before(*from) {
		return false
	}
	if to != nil && e.Timestamp.After(*to) {
		return false
	}
	return true
}

func keywordInDetails(e *AuditEntry, kw string) bool {
	lower := strings.ToLower(kw)
	for _, v := range e.Details {
		if strings.Contains(strings.ToLower(v), lower) {
			return true
		}
	}
	return false
}

func sortEntries(entries []AuditEntry, order SortOrder) {
	sort.Slice(entries, func(i, j int) bool {
		if order == SortAsc {
			return entries[i].Timestamp.Before(entries[j].Timestamp)
		}
		return entries[i].Timestamp.After(entries[j].Timestamp)
	})
}

func topAction(counts map[ActionType]int) ActionType {
	var best ActionType
	max := 0
	for a, c := range counts {
		if c > max {
			max = c
			best = a
		}
	}
	return best
}

func topResource(counts map[string]int) string {
	var best string
	max := 0
	for r, c := range counts {
		if c > max {
			max = c
			best = r
		}
	}
	return best
}

func copyDetails(src map[string]string) map[string]string {
	if src == nil {
		return nil
	}
	dst := make(map[string]string, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}
