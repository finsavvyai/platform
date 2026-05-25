// Package handlers — projects helper utilities split out so
// projects.go stays under the 200-LOC limit.
package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/projects"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

// statusFor maps domain errors to HTTP statuses for the projects API.
func statusFor(err error, w http.ResponseWriter) {
	switch {
	case errors.Is(err, projects.ErrNotFound), errors.Is(err, projects.ErrCrossTenant):
		writeErr(w, http.StatusNotFound, err)
	case errors.Is(err, projects.ErrInvalidName), errors.Is(err, projects.ErrInvalidRole):
		writeErr(w, http.StatusBadRequest, err)
	case errors.Is(err, projects.ErrNotMember):
		writeErr(w, http.StatusForbidden, err)
	default:
		writeErr(w, http.StatusInternalServerError, err)
	}
}

type addMemberBody struct {
	UserID uuid.UUID     `json:"user_id"`
	Role   projects.Role `json:"role"`
}

func addMember(d ProjectsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenant, err := d.TenantFrom(r)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, err)
			return
		}
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		var body addMemberBody
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		m, err := d.Service.AddMember(r.Context(), tenant, id, body.UserID, body.Role)
		if err != nil {
			statusFor(err, w)
			return
		}
		writeJSON(w, http.StatusCreated, m)
	}
}

func removeMember(d ProjectsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenant, err := d.TenantFrom(r)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, err)
			return
		}
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		userID, err := uuid.Parse(chi.URLParam(r, "user_id"))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := d.Service.RemoveMember(r.Context(), tenant, id, userID); err != nil {
			statusFor(err, w)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
