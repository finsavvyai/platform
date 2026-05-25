// Compliance — audit events read endpoint.
//
// GET /compliance/audit-events?from=&to=&actor_id=&action=&cursor=&limit=
//
// This delegates to the existing audit reader (the same store that
// backs /admin/audit-logs) but enforces the stricter `compliance:read`
// permission and a tighter rate-limit (mounted in router.go).
//
// Day 32 of the production-ready roadmap (Track B).
package compliance

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
)

// SchemaVersion is the versioned-schema header value applied to every
// compliance response. Bumped (v2, v3, ...) when shapes change.
const SchemaVersion = "v1"

// AuditEventReader is the minimal slice the handler needs.
// In prod this is satisfied by the same repository that backs the
// admin audit handler — exposed here as its own interface so the
// compliance package has no upward dependency on internal/.
type AuditEventReader interface {
	Query(ctx context.Context, q AuditEventQuery) (AuditEventPage, error)
}

// AuditEventQuery is the parsed + validated request shape.
type AuditEventQuery struct {
	TenantID *uuid.UUID
	ActorID  *uuid.UUID
	Action   string
	From     *time.Time
	To       *time.Time
	Cursor   string
	Limit    int
}

// AuditEventPage is one page of results.
type AuditEventPage struct {
	Rows       []AuditEventRow `json:"rows"`
	NextCursor string          `json:"next_cursor,omitempty"`
}

// AuditEventRow is the JSON shape returned externally. Stable.
type AuditEventRow struct {
	ID        uuid.UUID  `json:"id"`
	TenantID  uuid.UUID  `json:"tenant_id"`
	ActorID   *uuid.UUID `json:"actor_id,omitempty"`
	ActorType string     `json:"actor_type"`
	Action    string     `json:"action"`
	Target    string     `json:"target,omitempty"`
	IP        string     `json:"ip,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

// AuditEventDeps wires the reader into the handler factory.
type AuditEventDeps struct {
	Reader AuditEventReader
}

// AuditEventsHandler returns the http.HandlerFunc for the endpoint.
func AuditEventsHandler(deps AuditEventDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q, err := parseAuditEventQuery(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		page, err := deps.Reader.Query(r.Context(), q)
		if err != nil {
			http.Error(w, "audit query failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		writeComplianceJSON(w, http.StatusOK, page)
	}
}

func parseAuditEventQuery(r *http.Request) (AuditEventQuery, error) {
	q := AuditEventQuery{
		Action: r.URL.Query().Get("action"),
		Cursor: r.URL.Query().Get("cursor"),
	}
	if raw := r.URL.Query().Get("actor_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return q, &errBadQuery{"actor_id must be a UUID"}
		}
		q.ActorID = &id
	}
	if raw := r.URL.Query().Get("from"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return q, &errBadQuery{"from must be RFC3339"}
		}
		q.From = &t
	}
	if raw := r.URL.Query().Get("to"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return q, &errBadQuery{"to must be RFC3339"}
		}
		q.To = &t
	}
	limit := 100
	if raw := r.URL.Query().Get("limit"); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v < 1 || v > 1000 {
			return q, &errBadQuery{"limit must be 1..1000"}
		}
		limit = v
	}
	q.Limit = limit
	return q, nil
}
