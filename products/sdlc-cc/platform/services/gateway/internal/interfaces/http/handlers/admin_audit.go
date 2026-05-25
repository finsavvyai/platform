// Read-only audit log query API for SOC officers + compliance reviews
// (Day 13 of the production-ready roadmap).
//
// GET /admin/audit-logs?actor_id=&action=&from=&to=&tenant_id=&cursor=&limit=
// streams CSV when `Accept: text/csv` is sent so a 30-day export
// doesn't load the full table into memory. Permission gate:
// `admin:audit:read` (enforced by the chain's admin middleware).

package handlers

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// AuditQueryDeps is the minimal slice of dependencies the handler needs.
type AuditQueryDeps struct {
	Reader AuditLogReader
}

// AuditLogReader is satisfied by the gateway's audit repository.
// Defined as an interface so the handler test can use a fake.
type AuditLogReader interface {
	Query(ctx context.Context, q AuditQuery) (AuditPage, error)
}

// AuditQuery is the parsed + validated request shape.
type AuditQuery struct {
	TenantID *uuid.UUID
	ActorID  *uuid.UUID
	Action   string
	From     *time.Time
	To       *time.Time
	Cursor   string
	Limit    int
}

// AuditPage is one page of results plus the cursor for the next page.
type AuditPage struct {
	Rows       []AuditRow `json:"rows"`
	NextCursor string     `json:"next_cursor,omitempty"`
}

// AuditRow is the JSON-serializable shape returned to the API caller.
type AuditRow struct {
	ID         uuid.UUID  `json:"id"`
	TenantID   uuid.UUID  `json:"tenant_id"`
	ActorID    *uuid.UUID `json:"actor_id,omitempty"`
	ActorType  string     `json:"actor_type"`
	Action     string     `json:"action"`
	TargetType string     `json:"target_type,omitempty"`
	TargetID   string     `json:"target_id,omitempty"`
	IP         string     `json:"ip_address,omitempty"`
	UserAgent  string     `json:"user_agent,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// QueryAuditLogs handles GET /admin/audit-logs.
func QueryAuditLogs(deps AuditQueryDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q, err := parseAuditQuery(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		page, err := deps.Reader.Query(r.Context(), q)
		if err != nil {
			http.Error(w, "audit query failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if strings.Contains(r.Header.Get("Accept"), "text/csv") {
			writeAuditCSV(w, page.Rows)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(page)
	}
}

func parseAuditQuery(r *http.Request) (AuditQuery, error) {
	q := AuditQuery{
		Action: r.URL.Query().Get("action"),
		Cursor: r.URL.Query().Get("cursor"),
	}

	if raw := r.URL.Query().Get("tenant_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return q, &queryError{"tenant_id must be a UUID"}
		}
		q.TenantID = &id
	}
	if raw := r.URL.Query().Get("actor_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return q, &queryError{"actor_id must be a UUID"}
		}
		q.ActorID = &id
	}
	if raw := r.URL.Query().Get("from"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return q, &queryError{"from must be RFC3339"}
		}
		q.From = &t
	}
	if raw := r.URL.Query().Get("to"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return q, &queryError{"to must be RFC3339"}
		}
		q.To = &t
	}
	limit := 100
	if raw := r.URL.Query().Get("limit"); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v < 1 || v > 1000 {
			return q, &queryError{"limit must be 1..1000"}
		}
		limit = v
	}
	q.Limit = limit
	return q, nil
}

func writeAuditCSV(w http.ResponseWriter, rows []AuditRow) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="audit-logs.csv"`)
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{
		"id", "tenant_id", "actor_id", "actor_type", "action",
		"target_type", "target_id", "ip", "user_agent", "created_at",
	})
	for _, row := range rows {
		actorID := ""
		if row.ActorID != nil {
			actorID = row.ActorID.String()
		}
		_ = cw.Write([]string{
			row.ID.String(),
			row.TenantID.String(),
			actorID,
			row.ActorType,
			row.Action,
			row.TargetType,
			row.TargetID,
			row.IP,
			row.UserAgent,
			row.CreatedAt.Format(time.RFC3339Nano),
		})
	}
	cw.Flush()
}

type queryError struct{ msg string }

func (e *queryError) Error() string { return e.msg }

