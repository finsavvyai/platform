package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/aegis-aml/aegis/internal/email"
)

// issueResetToken inserts a fresh reset row for the user and sends
// the raw token by email. Email failures are logged but do not
// fail the HTTP response — the caller intentionally never reveals
// whether a given address exists in the system.
func (h *ResetHandler) issueResetToken(
	r *http.Request, addr, userID string,
) error {
	token, tokenHash := generateResetToken()
	id := fmt.Sprintf("rst_%d", time.Now().UnixNano())
	expires := time.Now().Add(1 * time.Hour)

	if _, err := h.db.ExecContext(r.Context(), `
		INSERT INTO password_resets (id, user_id, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
	`, id, userID, tokenHash, expires); err != nil {
		return err
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "https://amliq.finance"
	}
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, token)
	html := email.ResetPasswordEmail(resetURL)
	if err := h.mailer.Send(addr, "Reset your AMLIQ password", html); err != nil {
		log.Printf("reset email failed for %s: %v", addr, err)
	}
	return nil
}

func generateResetToken() (token, hash string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	token = hex.EncodeToString(b)
	return token, hashToken(token)
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
