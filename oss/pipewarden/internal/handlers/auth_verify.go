package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// AuthVerifyRequest issues a verification email to the currently
// signed-in user. Idempotent — repeated calls just send a new token,
// older tokens become valid until expiry.
func (h *Handlers) AuthVerifyRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims, err := auth.SessionFromRequest(r)
	if err != nil {
		jsonError(w, "not authenticated", http.StatusUnauthorized)
		return
	}
	user, err := h.db.GetUserByID(claims.UserID)
	if err != nil {
		jsonError(w, "user lookup failed", http.StatusInternalServerError)
		return
	}
	tok, err := h.db.CreateAuthToken(user.ID, storage.TokenPurposeEmailVerify, 24*time.Hour)
	if err != nil {
		jsonError(w, "issue token: "+err.Error(), http.StatusInternalServerError)
		return
	}
	verifyURL := h.publicBaseURL(r) + "/api/v1/auth/verify/confirm?token=" + tok
	if err := h.email.SendVerification(user.Email, verifyURL); err != nil {
		jsonError(w, "send email: "+err.Error(), http.StatusBadGateway)
		return
	}
	jsonOK(w, map[string]any{"sent": true, "log_only": h.email.LogOnly()})
}

// AuthVerifyConfirm consumes the token from the email link and marks
// the user verified. GET so the link is clickable from any email client.
// Redirects to /dashboard on success and /verify-error on failure so
// the user always lands on a real page (no raw JSON in the browser).
func (h *Handlers) AuthVerifyConfirm(w http.ResponseWriter, r *http.Request) {
	tok := r.URL.Query().Get("token")
	if tok == "" {
		http.Redirect(w, r, "/verify-error/?reason=missing", http.StatusSeeOther)
		return
	}
	uid, err := h.db.ConsumeAuthToken(tok, storage.TokenPurposeEmailVerify)
	if err != nil {
		if errors.Is(err, storage.ErrTokenInvalid) {
			http.Redirect(w, r, "/verify-error/?reason=expired", http.StatusSeeOther)
			return
		}
		http.Redirect(w, r, "/verify-error/?reason=server", http.StatusSeeOther)
		return
	}
	_ = h.db.MarkEmailVerified(uid)
	http.Redirect(w, r, "/dashboard/?verified=1", http.StatusSeeOther)
}

// AuthPasswordResetBegin issues a password-reset token + email. Body:
// {email}. Always returns 200 even if the email isn't registered, so an
// attacker can't enumerate accounts via this endpoint.
func (h *Handlers) AuthPasswordResetBegin(w http.ResponseWriter, r *http.Request) {
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
		Email string `json:"email"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	user, err := h.db.GetUserByEmail(req.Email)
	if err == nil && user != nil {
		tok, terr := h.db.CreateAuthToken(user.ID, storage.TokenPurposePasswordReset, time.Hour)
		if terr == nil {
			resetURL := h.publicBaseURL(r) + "/reset-password/?token=" + tok
			_ = h.email.SendPasswordReset(user.Email, resetURL)
		}
	}
	// Constant-shape response — no signal about whether the email exists.
	jsonOK(w, map[string]any{"sent": true})
}

// AuthPasswordResetFinish accepts {token, password}, verifies the
// token, and rotates the user's bcrypt hash. New password is then
// auto-logged-in via session cookie so the user lands on the dashboard.
func (h *Handlers) AuthPasswordResetFinish(w http.ResponseWriter, r *http.Request) {
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
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	uid, err := h.db.ConsumeAuthToken(req.Token, storage.TokenPurposePasswordReset)
	if err != nil {
		jsonError(w, "token invalid or expired", http.StatusUnauthorized)
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		if errors.Is(err, auth.ErrPasswordTooShort) {
			jsonError(w, err.Error(), http.StatusUnprocessableEntity)
			return
		}
		jsonError(w, "hash failed", http.StatusInternalServerError)
		return
	}
	if err := h.db.UpdatePasswordHash(uid, hash); err != nil {
		jsonError(w, "update password: "+err.Error(), http.StatusInternalServerError)
		return
	}

	user, err := h.db.GetUserByID(uid)
	if err != nil {
		jsonError(w, "user lookup failed", http.StatusInternalServerError)
		return
	}
	tok, err := auth.IssueSession(user.ID, user.Email, user.Onboarded, user.PasswordVersion)
	if err != nil {
		jsonError(w, "session issue failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	auth.IssueSessionCookie(w, r, tok)
	jsonOK(w, map[string]any{"user": user, "next": "/dashboard"})
}
