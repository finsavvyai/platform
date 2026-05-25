// Per-user redaction view. Claude Team D1 closeout: GDPR Article 15
// requires that data subjects can see what was processed about
// them. This endpoint surfaces every DLP detection event recorded
// against the caller's own user id within an optional date range.
//
// RBAC: gating is intentionally loose — the user can always read
// their own redactions. Tenant scoping is enforced server-side so a
// caller cannot see another tenant's rows.
package me_redactions

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// Event is one detection row surfaced to the data subject.
type Event struct {
	ID        uuid.UUID `json:"id"`
	Action    string    `json:"action"`
	Leg       string    `json:"leg"`
	Types     []string  `json:"types"`
	Matches   int       `json:"matches"`
	CreatedAt time.Time `json:"created_at"`
}

// Page is the paginated response.
type Page struct {
	Events     []Event `json:"events"`
	NextCursor string  `json:"next_cursor,omitempty"`
}

// Reader is the data-layer contract. Real implementation lives in
// infrastructure/compliance; tests pass a fake.
type Reader interface {
	ListUserRedactions(ctx context.Context, q Query) (Page, error)
}

// Query carries filter + pagination knobs.
type Query struct {
	TenantID uuid.UUID
	UserID   uuid.UUID
	From     *time.Time
	To       *time.Time
	Cursor   string
	Limit    int
}

// Handler returns the GET /v1/me/redactions handler. tenantFrom and
// userFrom let the wiring layer plug in the chain's typed context
// keys.
func Handler(r Reader, tenantFrom, userFrom func(*http.Request) (uuid.UUID, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		if r == nil {
			writeJSONError(w, http.StatusServiceUnavailable,
				"redactions reader not configured")
			return
		}
		tenantID, err := tenantFrom(req)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, "missing tenant context")
			return
		}
		userID, err := userFrom(req)
		if err != nil {
			writeJSONError(w, http.StatusUnauthorized, "missing user context")
			return
		}
		q := Query{
			TenantID: tenantID,
			UserID:   userID,
			Cursor:   req.URL.Query().Get("cursor"),
		}
		if v := req.URL.Query().Get("from"); v != "" {
			t, perr := time.Parse(time.RFC3339, v)
			if perr != nil {
				writeJSONError(w, http.StatusBadRequest, "from must be RFC3339")
				return
			}
			q.From = &t
		}
		if v := req.URL.Query().Get("to"); v != "" {
			t, perr := time.Parse(time.RFC3339, v)
			if perr != nil {
				writeJSONError(w, http.StatusBadRequest, "to must be RFC3339")
				return
			}
			q.To = &t
		}
		if v := req.URL.Query().Get("limit"); v != "" {
			var n int
			for _, c := range v {
				if c < '0' || c > '9' {
					writeJSONError(w, http.StatusBadRequest, "limit must be a positive integer")
					return
				}
				n = n*10 + int(c-'0')
			}
			q.Limit = n
		}
		page, err := r.ListUserRedactions(req.Context(), q)
		if err != nil {
			writeJSONError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(page)
	}
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]string{"message": message},
	})
}
