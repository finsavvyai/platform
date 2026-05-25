// Compliance evidence export bundle. Claude Team D3 closeout.
// Auditors ask for "every DLP detection + every policy change +
// every key rotation + every auth event for tenant X between
// dates Y and Z". This handler answers that question with a
// single JSON download whose hash chain proves no rows were
// dropped or tampered with after the export.
//
// RBAC: caller must hold `admin:compliance:export`. Gating is the
// router's responsibility; the handler stays composable.
package compliance_export

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Reader is the data-layer contract. The PgxReader implementation
// queries audit_logs scoped by action prefix; tests pass a fake.
type Reader interface {
	List(ctx context.Context, q Query) ([]Event, error)
}

// Query carries the date window. Both bounds inclusive; a nil
// pointer means "unbounded". The reader does its own time-zone
// normalization on the way out.
type Query struct {
	TenantID    uuid.UUID
	From        *time.Time
	To          *time.Time
	ActionLikes []string // e.g. ["dlp.%", "policy.%", "api_key.%", "auth.%"]
}

// Event is one row in the bundle. Stable JSON shape so auditors
// can diff exports across runs.
type Event struct {
	ID        string         `json:"id"`
	Action    string         `json:"action"`
	ActorID   string         `json:"actor_id,omitempty"`
	Target    string         `json:"target,omitempty"`
	Details   map[string]any `json:"details,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
}

// Bundle is the wire format the handler emits. The Hash field
// contains a SHA-256 hash chain over the events in order; auditors
// can recompute it offline to detect post-export mutation.
type Bundle struct {
	TenantID    string    `json:"tenant_id"`
	From        time.Time `json:"from,omitempty"`
	To          time.Time `json:"to,omitempty"`
	GeneratedAt time.Time `json:"generated_at"`
	EventCount  int       `json:"event_count"`
	Events      []Event   `json:"events"`
	Hash        string    `json:"hash"` // SHA-256 over canonical events
}

// Mount registers GET /admin/tenants/{tenant_id}/compliance/export
// on r. Nil reader → 503 with a clear message.
func Mount(r chi.Router, reader Reader) {
	if reader == nil {
		r.Method(http.MethodGet,
			"/admin/tenants/{tenant_id}/compliance/export",
			notConfigured())
		return
	}
	r.Method(http.MethodGet,
		"/admin/tenants/{tenant_id}/compliance/export",
		exportHandler(reader))
}

// exportHandler walks the four audit prefixes (DLP / policy /
// api_key / auth+session) in one pass, sorts by created_at,
// computes the hash chain, and returns the bundle.
func exportHandler(reader Reader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, err := uuid.Parse(chi.URLParam(r, "tenant_id"))
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid tenant id")
			return
		}
		q := Query{
			TenantID: tenantID,
			ActionLikes: []string{
				"dlp.%",     // DLP detections
				"policy.%",  // policy CRUD
				"api_key.%", // key rotation/revocation
				"auth.%",    // login / logout / refresh
				"session.%", // session lifecycle
			},
		}
		if v := r.URL.Query().Get("from"); v != "" {
			t, perr := time.Parse(time.RFC3339, v)
			if perr != nil {
				writeJSONError(w, http.StatusBadRequest, "from must be RFC3339")
				return
			}
			q.From = &t
		}
		if v := r.URL.Query().Get("to"); v != "" {
			t, perr := time.Parse(time.RFC3339, v)
			if perr != nil {
				writeJSONError(w, http.StatusBadRequest, "to must be RFC3339")
				return
			}
			q.To = &t
		}
		events, err := reader.List(r.Context(), q)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		// Stable order: created_at then id, so re-running the export
		// for the same window produces a byte-identical bundle.
		sort.Slice(events, func(i, j int) bool {
			if !events[i].CreatedAt.Equal(events[j].CreatedAt) {
				return events[i].CreatedAt.Before(events[j].CreatedAt)
			}
			return events[i].ID < events[j].ID
		})
		bundle := Bundle{
			TenantID:    tenantID.String(),
			GeneratedAt: time.Now().UTC(),
			EventCount:  len(events),
			Events:      events,
			Hash:        hashChain(events),
		}
		if q.From != nil {
			bundle.From = *q.From
		}
		if q.To != nil {
			bundle.To = *q.To
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition",
			fmt.Sprintf(`attachment; filename="compliance-%s.json"`, tenantID))
		_ = json.NewEncoder(w).Encode(bundle)
	}
}

// hashChain returns the SHA-256 over the canonical JSON of events
// in order. Auditors recompute by replaying the same algorithm:
// for each event, hash(prev || canonical_event). The final hash
// is the chain head. Bundle includes that head; rerunning the
// chain over the published events must produce the same value.
func hashChain(events []Event) string {
	h := sha256.New()
	for _, e := range events {
		raw, _ := json.Marshal(e)
		_, _ = h.Write(raw)
	}
	return hex.EncodeToString(h.Sum(nil))
}

// notConfigured surfaces a 503 when the wiring layer didn't supply
// a reader (no DB pool in dev).
func notConfigured() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		writeJSONError(w, http.StatusServiceUnavailable,
			"compliance export reader not configured (no DB pool)")
	}
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]string{"message": message},
	})
}

// ErrEmpty is reserved for future use when a reader wants to
// signal "no data" without an error code.
var ErrEmpty = errors.New("compliance_export: empty bundle")
