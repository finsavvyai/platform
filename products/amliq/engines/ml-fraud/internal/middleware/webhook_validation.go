package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"
)

const (
	// WebhookSignatureHeader is the header containing the HMAC-SHA256 signature.
	WebhookSignatureHeader = "X-Webhook-Signature"
	// WebhookTimestampHeader is the header containing the Unix timestamp.
	WebhookTimestampHeader = "X-Webhook-Timestamp"
	// MaxWebhookAge is the maximum age of a webhook before it is considered
	// a replay and rejected (5 minutes).
	MaxWebhookAge = 5 * time.Minute
)

// WebhookValidationChi returns a Chi/net-http middleware that verifies:
//   - HMAC-SHA256 signature from X-Webhook-Signature header
//   - Timestamp from X-Webhook-Timestamp is not older than MaxWebhookAge
//   - Request body is valid JSON
//
// The shared secret is read from the WEBHOOK_SECRET environment variable.
func WebhookValidationChi(next http.Handler) http.Handler {
	secret := os.Getenv("WEBHOOK_SECRET")
	return WebhookValidationWithSecret(secret)(next)
}

// WebhookValidationWithSecret returns a middleware using the given secret.
func WebhookValidationWithSecret(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if secret == "" {
				writeJSON(w, http.StatusInternalServerError, map[string]string{
					"error": "webhook secret not configured",
				})
				return
			}

			// Validate timestamp to prevent replay attacks.
			tsHeader := r.Header.Get(WebhookTimestampHeader)
			if tsHeader == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "missing webhook timestamp header",
				})
				return
			}
			ts, err := strconv.ParseInt(tsHeader, 10, 64)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "invalid webhook timestamp",
				})
				return
			}
			age := time.Since(time.Unix(ts, 0))
			if age > MaxWebhookAge || age < -MaxWebhookAge {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "webhook timestamp too old or in the future",
				})
				return
			}

			// Read and buffer the body for signature verification.
			body, err := io.ReadAll(r.Body)
			if err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "failed to read request body",
				})
				return
			}
			r.Body = io.NopCloser(bytes.NewReader(body))

			// Validate JSON.
			if !json.Valid(body) {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "request body is not valid JSON",
				})
				return
			}

			// Verify HMAC-SHA256 signature.
			sigHeader := r.Header.Get(WebhookSignatureHeader)
			if sigHeader == "" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{
					"error": "missing webhook signature",
				})
				return
			}

			// Compute expected signature over "timestamp.body".
			signedPayload := append([]byte(tsHeader+"."), body...)
			mac := hmac.New(sha256.New, []byte(secret))
			mac.Write(signedPayload)
			expectedSig := hex.EncodeToString(mac.Sum(nil))

			if !hmac.Equal([]byte(sigHeader), []byte(expectedSig)) {
				writeJSON(w, http.StatusUnauthorized, map[string]string{
					"error": "invalid webhook signature",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}
