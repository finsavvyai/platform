package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// AuthLogin handles POST /api/v1/auth/login. Returns 401 on any failure
// (wrong email OR wrong password) — never leaks which half mismatched.
func (h *Handlers) AuthLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		jsonError(w, "failed to read body", http.StatusBadRequest)
		return
	}
	defer func() { _ = r.Body.Close() }()

	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Code     string `json:"code"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	user, err := h.db.GetUserByEmail(req.Email)
	if err != nil {
		if errors.Is(err, storage.ErrUserNotFound) {
			jsonError(w, auth.ErrInvalidCredentials.Error(), http.StatusUnauthorized)
			return
		}
		jsonError(w, "failed to look up user", http.StatusInternalServerError)
		return
	}
	if err := auth.VerifyPassword(user.PasswordHash, req.Password); err != nil {
		jsonError(w, auth.ErrInvalidCredentials.Error(), http.StatusUnauthorized)
		return
	}
	if !h.totpCheck(user.ID, req.Code, w) {
		return
	}

	token, err := auth.IssueSession(user.ID, user.Email, user.Onboarded, user.PasswordVersion)
	if err != nil {
		jsonError(w, "failed to issue session: "+err.Error(), http.StatusInternalServerError)
		return
	}
	auth.IssueSessionCookie(w, r, token)

	next := "/dashboard"
	if !user.Onboarded {
		next = "/onboarding"
	}
	jsonOK(w, map[string]any{"user": user, "next": next})
}

// AuthLogout handles POST /api/v1/auth/logout. Clears the cookie. Idempotent.
func (h *Handlers) AuthLogout(w http.ResponseWriter, r *http.Request) {
	auth.ClearSessionCookie(w, r)
	jsonOK(w, map[string]any{"ok": true})
}
