package api

import "net/http"

// ExecuteReset validates a reset token and updates the user's
// password. The token itself is never stored — only its SHA-256.
// A successful reset marks the row as used so the link becomes
// one-shot.
func (h *ResetHandler) ExecuteReset(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	if req.Token == "" || len(req.Password) < 8 {
		Error(w, "VALIDATION",
			"token and password (8+ chars) required",
			http.StatusBadRequest)
		return
	}

	tokenHash := hashToken(req.Token)
	var userID string
	err := h.db.QueryRowContext(r.Context(), `
		SELECT user_id FROM password_resets
		WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
	`, tokenHash).Scan(&userID)
	if err != nil {
		Error(w, "INVALID_TOKEN",
			"invalid or expired reset token",
			http.StatusBadRequest)
		return
	}

	hashed := hashPassword(req.Password)
	if hashed == "" {
		Error(w, "INTERNAL", "hash error", http.StatusInternalServerError)
		return
	}
	if _, err := h.db.ExecContext(r.Context(), `
		UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2
	`, hashed, userID); err != nil {
		Error(w, "DB_ERROR", "update failed", http.StatusInternalServerError)
		return
	}

	// Mark the reset row as used — ignore the rare error here
	// because the password itself was already updated and the worst
	// case is a token staying valid until its expires_at.
	_, _ = h.db.ExecContext(r.Context(), `
		UPDATE password_resets SET used_at = NOW() WHERE token_hash = $1
	`, tokenHash)

	Success(w, map[string]string{"message": "Password updated"}, http.StatusOK)
}
