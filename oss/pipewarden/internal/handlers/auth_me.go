package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// AuthMe handles GET /api/v1/auth/me. Returns the current user when a
// valid session cookie is present; 401 otherwise. Frontend uses this on
// load to decide whether to show login or dashboard.
func (h *Handlers) AuthMe(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.SessionFromRequest(r)
	if err != nil {
		jsonError(w, "not authenticated", http.StatusUnauthorized)
		return
	}
	user, err := h.db.GetUserByID(claims.UserID)
	if err != nil {
		if errors.Is(err, storage.ErrUserNotFound) {
			// User was deleted but cookie is still valid — clear and 401.
			auth.ClearSessionCookie(w, r)
			jsonError(w, "not authenticated", http.StatusUnauthorized)
			return
		}
		jsonError(w, "lookup failed", http.StatusInternalServerError)
		return
	}
	if claims.PasswordVersion < user.PasswordVersion {
		// Password was reset since this session was issued — invalidate.
		auth.ClearSessionCookie(w, r)
		jsonError(w, "session expired (password changed)", http.StatusUnauthorized)
		return
	}
	jsonOK(w, map[string]any{"user": user})
}

// AuthOnboarding handles POST /api/v1/auth/onboarding. Body: {name, company}.
// Marks the user as onboarded and re-issues the session so the cookie
// claim reflects the new state without requiring a re-login.
func (h *Handlers) AuthOnboarding(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims, err := auth.SessionFromRequest(r)
	if err != nil {
		jsonError(w, "not authenticated", http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		jsonError(w, "failed to read body", http.StatusBadRequest)
		return
	}
	defer func() { _ = r.Body.Close() }()

	var req struct {
		Name    string `json:"name"`
		Company string `json:"company"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		jsonError(w, "name is required", http.StatusUnprocessableEntity)
		return
	}

	if err := h.db.MarkOnboarded(claims.UserID, req.Name, req.Company); err != nil {
		jsonError(w, "failed to mark onboarded: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Re-issue session so onboarded=true is reflected in the cookie.
	token, err := auth.IssueSession(claims.UserID, claims.Email, true, claims.PasswordVersion)
	if err != nil {
		jsonError(w, "failed to refresh session", http.StatusInternalServerError)
		return
	}
	auth.IssueSessionCookie(w, r, token)

	user, _ := h.db.GetUserByID(claims.UserID)
	jsonOK(w, map[string]any{"user": user, "next": "/dashboard"})
}
