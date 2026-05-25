// Compliance — DLP detection event log.
//
// GET /compliance/dlp-events?tenant_id=&from=&to=&action=&cursor=&limit=
//
// Paginated list of DLP detections (mask/redact/block) with the matched
// detector type and the action taken. Used by SOC auditors to verify
// that the configured DLP policy is firing as expected.
//
// Day 32 of the production-ready roadmap.
package compliance

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
)

// DLPEventReader is the minimal slice the handler needs.
type DLPEventReader interface {
	List(ctx context.Context, q DLPEventQuery) (DLPEventPage, error)
}

// DLPEventQuery is the parsed request shape.
type DLPEventQuery struct {
	TenantID uuid.UUID
	Action   string
	From     *time.Time
	To       *time.Time
	Cursor   string
	Limit    int
}

// DLPEventPage is one page.
type DLPEventPage struct {
	Rows       []DLPEventRow `json:"rows"`
	NextCursor string        `json:"next_cursor,omitempty"`
}

// DLPEventRow is the JSON shape returned.
type DLPEventRow struct {
	ID         uuid.UUID `json:"id"`
	TenantID   uuid.UUID `json:"tenant_id"`
	UserID     *uuid.UUID `json:"user_id,omitempty"`
	Detector   string    `json:"detector"`        // ssn|cc|itin|mrn|...
	Direction  string    `json:"direction"`       // inbound|outbound
	Action     string    `json:"action"`          // mask|redact|block
	MatchCount int       `json:"match_count"`
	OccurredAt time.Time `json:"occurred_at"`
}

// DLPEventDeps wires the reader.
type DLPEventDeps struct {
	Reader DLPEventReader
}

// DLPEventsHandler returns the http.HandlerFunc.
func DLPEventsHandler(deps DLPEventDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q, err := parseDLPEventQuery(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		page, err := deps.Reader.List(r.Context(), q)
		if err != nil {
			http.Error(w, "dlp events failed: "+err.Error(), http.StatusInternalServerError)
			return
		}
		writeComplianceJSON(w, http.StatusOK, page)
	}
}

func parseDLPEventQuery(r *http.Request) (DLPEventQuery, error) {
	q := DLPEventQuery{Action: r.URL.Query().Get("action"), Cursor: r.URL.Query().Get("cursor")}
	tenantID, err := requiredTenantID(r)
	if err != nil {
		return q, err
	}
	q.TenantID = tenantID
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
	if q.Action != "" && q.Action != "mask" && q.Action != "redact" && q.Action != "block" {
		return q, &errBadQuery{"action must be mask|redact|block"}
	}
	return q, nil
}
