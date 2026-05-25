package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// AuthSignup handles POST /api/v1/auth/signup. Body: {email, password,
// name?, company?}. Creates the user, issues a session cookie, returns
// {user} so the client can route straight to onboarding.
func (h *Handlers) AuthSignup(w http.ResponseWriter, r *http.Request) {
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
		Name     string `json:"name"`
		Company  string `json:"company"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		jsonError(w, "valid email is required", http.StatusUnprocessableEntity)
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		if errors.Is(err, auth.ErrPasswordTooShort) {
			jsonError(w, err.Error(), http.StatusUnprocessableEntity)
			return
		}
		jsonError(w, "failed to hash password", http.StatusInternalServerError)
		return
	}

	user, err := h.db.CreateUser(req.Email, hash, req.Name, req.Company)
	if err != nil {
		if errors.Is(err, storage.ErrUserExists) {
			jsonError(w, "email is already registered", http.StatusConflict)
			return
		}
		jsonError(w, "failed to create user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	token, err := auth.IssueSession(user.ID, user.Email, user.Onboarded, user.PasswordVersion)
	if err != nil {
		jsonError(w, "failed to issue session: "+err.Error(), http.StatusInternalServerError)
		return
	}
	auth.IssueSessionCookie(w, r, token)

	jsonOK(w, map[string]any{"user": user, "next": "/onboarding"})
}
