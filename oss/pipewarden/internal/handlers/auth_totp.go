package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/auth"
	"github.com/pquerna/otp/totp"
)

// AuthTOTPSetup begins TOTP enrollment for the signed-in user. Generates
// a fresh secret, persists it as PROVISIONAL (totp_enabled=0), and
// returns the otpauth:// URL + raw secret so the client can render a
// QR code. Enrolment isn't complete until AuthTOTPVerify succeeds.
func (h *Handlers) AuthTOTPSetup(w http.ResponseWriter, r *http.Request) {
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
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "PipeWarden",
		AccountName: user.Email,
	})
	if err != nil {
		jsonError(w, "totp generate: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := h.db.SetTOTPSecret(user.ID, key.Secret(), false); err != nil {
		jsonError(w, "store secret: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{
		"secret":   key.Secret(),
		"otpauth":  key.URL(),
		"verified": false,
	})
}

// AuthTOTPVerify confirms the user can produce a valid code and flips
// totp_enabled to 1. Body: {code}. Without this confirmation step, a
// half-set-up TOTP would lock the user out if the secret was stored
// but the authenticator app failed to register it.
func (h *Handlers) AuthTOTPVerify(w http.ResponseWriter, r *http.Request) {
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
		Code string `json:"code"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	user, err := h.db.GetUserByID(claims.UserID)
	if err != nil {
		jsonError(w, "user lookup failed", http.StatusInternalServerError)
		return
	}
	secret, _, err := h.db.GetTOTPState(user.ID)
	if err != nil || secret == "" {
		jsonError(w, "no TOTP enrolment in progress", http.StatusBadRequest)
		return
	}
	if !totp.Validate(req.Code, secret) {
		jsonError(w, "invalid code", http.StatusUnauthorized)
		return
	}
	if err := h.db.SetTOTPSecret(user.ID, secret, true); err != nil {
		jsonError(w, "enable TOTP: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"enabled": true})
}

// AuthTOTPDisable turns off 2FA. Requires the user to prove they still
// control the authenticator (current code) — prevents a stolen session
// cookie from disabling 2FA silently.
func (h *Handlers) AuthTOTPDisable(w http.ResponseWriter, r *http.Request) {
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
		Code string `json:"code"`
	}
	_ = json.Unmarshal(body, &req)

	secret, enabled, err := h.db.GetTOTPState(claims.UserID)
	if err != nil || !enabled {
		jsonError(w, "TOTP not enabled", http.StatusBadRequest)
		return
	}
	if !totp.Validate(req.Code, secret) {
		jsonError(w, "invalid code", http.StatusUnauthorized)
		return
	}
	if err := h.db.SetTOTPSecret(claims.UserID, "", false); err != nil {
		jsonError(w, "disable TOTP: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"enabled": false})
}
