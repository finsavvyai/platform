package api

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/aegis-aml/aegis/internal/mfa"
)

// MFAHandler manages TOTP MFA setup and verification.
type MFAHandler struct {
	db *sql.DB
}

func NewMFAHandler(db *sql.DB) *MFAHandler {
	return &MFAHandler{db: db}
}

// Setup generates a TOTP secret and returns QR code URL.
// POST /api/v1/auth/mfa/setup
func (h *MFAHandler) Setup(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "UNAUTHORIZED", "missing auth", http.StatusUnauthorized)
		return
	}

	secret := mfa.GenerateSecret()
	recoveryCodes := mfa.GenerateRecoveryCodes()

	// Store secret (not yet enabled — user must verify first)
	_, err := h.db.ExecContext(r.Context(), `
		UPDATE users SET mfa_secret = $1, mfa_recovery_codes = $2
		WHERE id = $3
	`, secret, strings.Join(recoveryCodes, ","), claims.UserID)
	if err != nil {
		Error(w, "DB_ERROR", "setup failed", http.StatusInternalServerError)
		return
	}

	var email string
	h.db.QueryRowContext(r.Context(),
		"SELECT email FROM users WHERE id = $1", claims.UserID).Scan(&email)

	qrURL := mfa.QRCodeURL(secret, email, "AMLIQ")

	Success(w, map[string]interface{}{
		"qr_url":         qrURL,
		"secret":         secret,
		"recovery_codes": recoveryCodes,
		"message":        "Scan QR code with authenticator app, then verify",
	}, http.StatusOK)
}

// Verify validates the TOTP code and enables MFA.
// POST /api/v1/auth/mfa/verify
func (h *MFAHandler) Verify(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "UNAUTHORIZED", "missing auth", http.StatusUnauthorized)
		return
	}

	var req struct {
		Code string `json:"code"`
	}
	if err := DecodeJSON(r, &req); err != nil || req.Code == "" {
		Error(w, "VALIDATION", "6-digit code required", http.StatusBadRequest)
		return
	}

	var secret string
	err := h.db.QueryRowContext(r.Context(), `
		SELECT mfa_secret FROM users WHERE id = $1
	`, claims.UserID).Scan(&secret)
	if err != nil || secret == "" {
		Error(w, "MFA_NOT_SETUP", "call /mfa/setup first", http.StatusBadRequest)
		return
	}

	if !mfa.Verify(secret, req.Code) {
		Error(w, "INVALID_CODE", "incorrect code", http.StatusUnauthorized)
		return
	}

	// Enable MFA
	h.db.ExecContext(r.Context(), `
		UPDATE users SET mfa_enabled = TRUE WHERE id = $1
	`, claims.UserID)

	Success(w, map[string]string{
		"message": "MFA enabled successfully",
	}, http.StatusOK)
}

// Challenge validates TOTP during login.
// POST /api/v1/auth/mfa/challenge
func (h *MFAHandler) Challenge(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID string `json:"user_id"`
		Code   string `json:"code"`
	}
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}

	var secret string
	h.db.QueryRowContext(r.Context(), `
		SELECT mfa_secret FROM users WHERE id = $1 AND mfa_enabled = TRUE
	`, req.UserID).Scan(&secret)

	if secret == "" || !mfa.Verify(secret, req.Code) {
		Error(w, "INVALID_CODE", "incorrect MFA code", http.StatusUnauthorized)
		return
	}

	Success(w, map[string]string{"status": "verified"}, http.StatusOK)
}
