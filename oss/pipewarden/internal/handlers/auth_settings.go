package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/auth"
)

// AuthListPasskeys returns the credentials registered for the current
// user — credential_id is base64'd by the encoder, public key is omitted
// from the JSON shape (PasskeyRecord has json:"-").
func (h *Handlers) AuthListPasskeys(w http.ResponseWriter, r *http.Request) {
	claims, err := auth.SessionFromRequest(r)
	if err != nil {
		jsonError(w, "not authenticated", http.StatusUnauthorized)
		return
	}
	creds, err := h.db.ListPasskeysForUser(claims.UserID)
	if err != nil {
		jsonError(w, "list passkeys: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"passkeys": creds})
}

// AuthDeletePasskey removes a registered passkey by primary key. The
// {id} segment is the passkey row id (not the WebAuthn credential id).
// Verifies ownership before deleting so users can't drop each other's
// credentials by guessing IDs.
func (h *Handlers) AuthDeletePasskey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	claims, err := auth.SessionFromRequest(r)
	if err != nil {
		jsonError(w, "not authenticated", http.StatusUnauthorized)
		return
	}
	idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/auth/passkeys/")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, "invalid passkey id", http.StatusBadRequest)
		return
	}
	if err := h.db.DeletePasskey(claims.UserID, id); err != nil {
		jsonError(w, "delete passkey: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"ok": true})
}

// AuthSettings returns the current user's complete auth state — passkeys,
// TOTP, GitHub link, email-verified — for the /settings/ page to render
// without making N round trips.
func (h *Handlers) AuthSettings(w http.ResponseWriter, r *http.Request) {
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
	creds, _ := h.db.ListPasskeysForUser(user.ID)
	_, totpEnabled, _ := h.db.GetTOTPState(user.ID)
	jsonOK(w, map[string]any{
		"user":           user,
		"passkeys":       creds,
		"totp_enabled":   totpEnabled,
		"email_verified": false, // wired in storage_users next pass; default false
		"github_linked":  false, // same
	})
}
