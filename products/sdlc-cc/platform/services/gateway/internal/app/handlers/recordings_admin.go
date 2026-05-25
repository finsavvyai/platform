package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	appmw "github.com/sdlc-ai/platform/services/gateway/internal/app/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/record"
)

// RecordingsDeps wires the admin session recordings handler.
type RecordingsDeps struct {
	// Reader fetches recording rows from session_recordings. If nil,
	// MountRecordings is a no-op so the service is safe to call in dev.
	Reader record.Reader
	// RBAC enforces admin:audit:read. Nil degrades to passthrough (dev mode).
	RBAC *appmw.RBAC
	// TenantFrom extracts the requesting admin's tenant ID from the request.
	// Used to scope the query to their own sessions only.
	TenantFrom func(*http.Request) (uuid.UUID, error)
}

// MountRecordings registers GET /admin/recordings/{session_id} on r.
// Skips registration when Reader is nil so dev / no-DB boots cleanly.
func MountRecordings(r chi.Router, deps RecordingsDeps) {
	if deps.Reader == nil {
		return
	}
	gate := func(next http.Handler) http.Handler { return next }
	if deps.RBAC != nil {
		gate = deps.RBAC.RequirePermission("admin:audit:read")
	}
	r.With(gate).Get("/admin/recordings/{session_id}", getSessionRecording(deps))
}

func getSessionRecording(deps RecordingsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw := chi.URLParam(r, "session_id")
		sid, err := uuid.Parse(raw)
		if err != nil {
			writeRecordingJSON(w, http.StatusBadRequest,
				map[string]string{"error": "invalid session_id: " + raw})
			return
		}

		var tenantID uuid.UUID
		if deps.TenantFrom != nil {
			tenantID, _ = deps.TenantFrom(r)
		}

		rows, err := deps.Reader.ListBySession(r.Context(), sid, tenantID)
		if err != nil {
			writeRecordingJSON(w, http.StatusInternalServerError,
				map[string]string{"error": err.Error()})
			return
		}
		if rows == nil {
			rows = []record.Row{} // always return an array, never null
		}
		writeRecordingJSON(w, http.StatusOK, map[string]any{"data": rows})
	}
}

func writeRecordingJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
