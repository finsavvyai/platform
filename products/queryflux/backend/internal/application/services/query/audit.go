package query

import (
	"context"
	"sync"
	"time"
)

// AuditEntry is the structured record persisted for every query
// execution. Raw SQL is omitted by default (PII risk); the SHA-256
// hash is stored instead so audits can correlate queries without
// retaining user data.
type AuditEntry struct {
	ConnectionID string    `json:"connection_id"`
	UserID       string    `json:"user_id"`
	QueryHash    string    `json:"query_hash"`
	DurationMs   int64     `json:"duration_ms"`
	RowCount     int64     `json:"row_count"`
	ErrorClass   string    `json:"error_class,omitempty"`
	Timestamp    time.Time `json:"timestamp"`
	RawSQL       string    `json:"raw_sql,omitempty"` // only when FullSQL=true
}

// AuditLogger persists or forwards AuditEntry records. The runner
// fan-outs to it after every Execute / Stream regardless of success
// so log volume reflects real traffic. Implementations MUST NOT
// block the caller for more than a few milliseconds; use a buffered
// background writer if persistence is slow.
type AuditLogger interface {
	Log(ctx context.Context, entry AuditEntry)
}

// NopAuditLogger discards entries. Used as the default when callers
// pass nil to NewSafeQueryRunner so production calls never panic on
// a missing dependency.
type NopAuditLogger struct{}

// Log implements AuditLogger.
func (NopAuditLogger) Log(_ context.Context, _ AuditEntry) {}

// InMemoryAuditLogger captures entries in a slice. Used by unit
// tests and the local dev MCP server. Safe for concurrent use.
type InMemoryAuditLogger struct {
	mu      sync.Mutex
	entries []AuditEntry
}

// NewInMemoryAuditLogger constructs an empty in-memory logger.
func NewInMemoryAuditLogger() *InMemoryAuditLogger {
	return &InMemoryAuditLogger{}
}

// Log appends entry to the buffer under the mutex.
func (l *InMemoryAuditLogger) Log(_ context.Context, entry AuditEntry) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.entries = append(l.entries, entry)
}

// Snapshot returns a copy of the captured entries. The caller may
// mutate the returned slice freely.
func (l *InMemoryAuditLogger) Snapshot() []AuditEntry {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := make([]AuditEntry, len(l.entries))
	copy(out, l.entries)
	return out
}

// Len returns the number of entries captured so far. Cheap status
// poll for tests that only need a count assertion.
func (l *InMemoryAuditLogger) Len() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.entries)
}

// Reset clears the entry buffer. Used by table-driven tests that
// reuse the logger across sub-cases.
func (l *InMemoryAuditLogger) Reset() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.entries = nil
}
