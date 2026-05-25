package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
)

// generateRawKey returns a "pw_" prefixed URL-safe base64 key from 32 random bytes.
func generateRawKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return "pw_" + base64.RawURLEncoding.EncodeToString(b), nil
}

// hashKey returns the hex-encoded SHA-256 hash of the key.
func hashKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return fmt.Sprintf("%x", h)
}

// GenerateAPIKey handles POST /api/v1/connections/{name}/apikey.
// It generates a new API key for embed widget access on the named connection.
func (h *Handlers) GenerateAPIKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	name := strings.TrimPrefix(r.URL.Path, "/api/v1/connections/")
	name = strings.TrimSuffix(name, "/apikey")
	if name == "" {
		jsonError(w, "connection name is required", http.StatusBadRequest)
		return
	}

	rawKey, err := generateRawKey()
	if err != nil {
		jsonError(w, "failed to generate key", http.StatusInternalServerError)
		return
	}

	if err := h.db.CreateAPIKey(name, hashKey(rawKey)); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{
		"connection": name,
		"api_key":    rawKey,
		"note":       "Store this key securely — it will not be shown again.",
	})
}

// RevokeAPIKey handles DELETE /api/v1/connections/{name}/apikey.
// It revokes the API key for the named connection.
func (h *Handlers) RevokeAPIKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	name := strings.TrimPrefix(r.URL.Path, "/api/v1/connections/")
	name = strings.TrimSuffix(name, "/apikey")
	if name == "" {
		jsonError(w, "connection name is required", http.StatusBadRequest)
		return
	}

	if err := h.db.DeleteAPIKey(name); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]string{"status": "revoked", "connection": name})
}

// ValidateEmbedAPIKey checks the apikey query parameter for embed endpoints.
// Returns (connectionName, true) when valid, ("", false) when absent,
// and writes a 401 + returns ("", false) on invalid.
func (h *Handlers) ValidateEmbedAPIKey(w http.ResponseWriter, r *http.Request) (string, bool, bool) {
	key := r.URL.Query().Get("apikey")
	if key == "" {
		return "", false, true // absent — fall through to existing auth
	}
	connName, err := h.db.ValidateAPIKey(hashKey(key))
	if err != nil {
		jsonError(w, "invalid api key", http.StatusUnauthorized)
		return "", true, false
	}
	return connName, true, true
}
