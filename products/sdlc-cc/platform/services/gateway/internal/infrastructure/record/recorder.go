// Package record — session recording with consent banner.
//
// Day 54 deliverable. The Recorder interface is the public seam;
// AppendOnlyPostgresRecorder is the production impl backed by the
// session_recordings table (append-only via trigger + REVOKE).
//
// The banner middleware injects an X-Recording-Active header on every
// response while recording is on, so SDK callers + admin UI can show
// a consent indicator. The header value is the consent token so the
// audit trail reflects which consent grant covers the session.
//
// At-rest encryption: when the recorder is constructed with a
// KEKProvider (see encryption.go), every event is sealed with a fresh
// per-record AES-256 DEK; the wrapped DEK + nonce + sealed bytes ride
// in the encrypted_payload column and the cleartext payload column is
// NULL. When KEKProvider is nil (dev / single-tenant test), the
// recorder falls back to writing cleartext JSON in payload — the
// CHECK constraint on session_recordings still enforces XOR.
package record

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Event is one session frame. Producers may emit any number per
// session; the recorder appends each row with a fresh timestamp.
type Event struct {
	Type    string         `json:"type"` // "request", "response", "tool_call", "error"
	At      time.Time      `json:"at"`
	Payload map[string]any `json:"payload,omitempty"`
}

// Recorder is the public seam.
type Recorder interface {
	Start(ctx context.Context, sessionID uuid.UUID, userID uuid.UUID, consentToken string) error
	Append(ctx context.Context, sessionID uuid.UUID, ev Event) error
	Stop(ctx context.Context, sessionID uuid.UUID) error
	Active(sessionID uuid.UUID) (string, bool)
}

// ErrNotRecording is returned when Append/Stop is called for a session
// that was never Started or has already been Stopped.
var ErrNotRecording = errors.New("record: session not active")

// TenantFn extracts the tenant id from a context. Wired by the gateway
// auth middleware; required because recordings are tenant-scoped.
type TenantFn func(ctx context.Context) (uuid.UUID, bool)

// AppendOnlyPostgresRecorder writes every Event as a new row.
//
// Active sessions are tracked in memory so Stop() can be idempotent
// and the banner middleware can answer Active(sessionID) cheaply.
type AppendOnlyPostgresRecorder struct {
	db       *sql.DB
	tenantFn TenantFn
	envelope *Envelope // nil = plaintext fallback (dev/test)

	mu     sync.RWMutex
	active map[uuid.UUID]session // sessionID → session metadata
}

type session struct {
	userID       uuid.UUID
	tenantID     uuid.UUID
	consentToken string
}

// NewAppendOnlyPostgresRecorder constructs the production recorder.
// Pass envelope=nil to disable at-rest encryption (dev/test only).
func NewAppendOnlyPostgresRecorder(db *sql.DB, tenantFn TenantFn) *AppendOnlyPostgresRecorder {
	return &AppendOnlyPostgresRecorder{
		db:       db,
		tenantFn: tenantFn,
		active:   make(map[uuid.UUID]session),
	}
}

// WithEnvelope returns a recorder that encrypts every payload with
// envelope. The recorder is mutated in place + returned for chaining.
func (r *AppendOnlyPostgresRecorder) WithEnvelope(envelope *Envelope) *AppendOnlyPostgresRecorder {
	r.envelope = envelope
	return r
}

// Start opens the session and writes a "session_start" event so the
// recording always has a known lower bound.
func (r *AppendOnlyPostgresRecorder) Start(ctx context.Context, sessionID, userID uuid.UUID, consentToken string) error {
	if consentToken == "" {
		return errors.New("record: consent token required to start recording")
	}
	tenantID, ok := r.tenantFn(ctx)
	if !ok {
		return errors.New("record: tenant id missing from context")
	}
	r.mu.Lock()
	r.active[sessionID] = session{userID: userID, tenantID: tenantID, consentToken: consentToken}
	r.mu.Unlock()
	return r.insert(ctx, sessionID, Event{Type: "session_start", At: time.Now().UTC()})
}

// Append writes one event row.
func (r *AppendOnlyPostgresRecorder) Append(ctx context.Context, sessionID uuid.UUID, ev Event) error {
	r.mu.RLock()
	_, ok := r.active[sessionID]
	r.mu.RUnlock()
	if !ok {
		return ErrNotRecording
	}
	if ev.At.IsZero() {
		ev.At = time.Now().UTC()
	}
	return r.insert(ctx, sessionID, ev)
}

// Stop emits a "session_stop" event and forgets the session.
func (r *AppendOnlyPostgresRecorder) Stop(ctx context.Context, sessionID uuid.UUID) error {
	r.mu.RLock()
	_, ok := r.active[sessionID]
	r.mu.RUnlock()
	if !ok {
		return ErrNotRecording
	}
	if err := r.insert(ctx, sessionID, Event{Type: "session_stop", At: time.Now().UTC()}); err != nil {
		return err
	}
	r.mu.Lock()
	delete(r.active, sessionID)
	r.mu.Unlock()
	return nil
}

// Active returns the consent token if sessionID is currently being
// recorded. Used by the banner middleware.
func (r *AppendOnlyPostgresRecorder) Active(sessionID uuid.UUID) (string, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	s, ok := r.active[sessionID]
	if !ok {
		return "", false
	}
	return s.consentToken, true
}

// insert is implemented in recorder_insert.go so the encryption branch
// can grow without pushing this file over the 200-line cap.

// SessionFromRequest pulls the session id from a request header.
// Returns zero uuid + false if the header is missing or malformed.
func SessionFromRequest(r *http.Request) (uuid.UUID, bool) {
	v := r.Header.Get("X-Session-ID")
	if v == "" {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(v)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

// BannerMiddleware injects X-Recording-Active: <consent-token> on
// responses for sessions that are currently being recorded.
func BannerMiddleware(rec Recorder) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if sid, ok := SessionFromRequest(r); ok {
				if token, active := rec.Active(sid); active {
					w.Header().Set("X-Recording-Active", token)
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
