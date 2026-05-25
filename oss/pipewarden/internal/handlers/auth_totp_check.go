package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/pquerna/otp/totp"
)

// totpCheck enforces 2FA on a login attempt. Returns true when the user
// is allowed to proceed: either TOTP is disabled, or the supplied code
// validates. Writes the appropriate JSON 401 response itself when 2FA
// fails so callers can early-return.
//
// Response shape on missing code: {code_required: true} so the frontend
// knows to render the TOTP prompt and retry the login with the code.
func (h *Handlers) totpCheck(userID int64, code string, w http.ResponseWriter) bool {
	secret, enabled, err := h.db.GetTOTPState(userID)
	if err != nil || !enabled {
		// 2FA not enabled — proceed.
		return true
	}
	if code == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"error":         "2FA code required",
			"code_required": true,
		})
		return false
	}
	if totp.Validate(code, secret) {
		return true
	}
	// Recovery code fallback. 10-char base32 codes won't match the
	// 6-digit TOTP format, so trying a wrong TOTP code never burns
	// a recovery code by accident.
	if err := h.db.ConsumeRecoveryCode(userID, code); err == nil {
		return true
	}
	jsonError(w, "invalid 2FA code", http.StatusUnauthorized)
	return false
}
