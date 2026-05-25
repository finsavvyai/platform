package api

import (
	"context"
	"database/sql"
	"log"
	"time"
)

// SecurityLogEntry represents one API access record.
type SecurityLogEntry struct {
	Method     string
	Path       string
	TenantID   string
	IP         string
	StatusCode int
	DurationMs int
	UserAgent  string
}

// SecurityLogWriter batches security log entries into PostgreSQL
// via a background goroutine so the HTTP path stays non-blocking.
type SecurityLogWriter struct {
	db *sql.DB
	ch chan SecurityLogEntry
}

// NewSecurityLogWriter starts a background writer with a buffered
// channel. Entries that arrive faster than the writer can flush
// are dropped (non-blocking send).
func NewSecurityLogWriter(db *sql.DB) *SecurityLogWriter {
	w := &SecurityLogWriter{
		db: db,
		ch: make(chan SecurityLogEntry, 1024),
	}
	go w.loop()
	return w
}

// Write enqueues a log entry without blocking the caller.
func (w *SecurityLogWriter) Write(e SecurityLogEntry) {
	select {
	case w.ch <- e:
	default:
		// channel full — drop entry to avoid backpressure
	}
}

func (w *SecurityLogWriter) loop() {
	for e := range w.ch {
		ctx, cancel := context.WithTimeout(
			context.Background(), 5*time.Second)
		_, err := w.db.ExecContext(ctx, `
			INSERT INTO security_logs
			(method, path, tenant_id, ip_address,
			 status_code, duration_ms, user_agent)
			VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			e.Method, e.Path, e.TenantID, e.IP,
			e.StatusCode, e.DurationMs, e.UserAgent)
		cancel()
		if err != nil {
			log.Printf("security_log write: %v", err)
		}
	}
}
