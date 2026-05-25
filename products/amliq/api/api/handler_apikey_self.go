package api

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"time"
)

// SelfKeyHandler lets tenants manage their own API keys.
type SelfKeyHandler struct {
	db *sql.DB
}

func NewSelfKeyHandler(db *sql.DB) *SelfKeyHandler {
	return &SelfKeyHandler{db: db}
}

// GenerateKey creates a new API key for the caller's tenant.
func (h *SelfKeyHandler) GenerateKey(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "UNAUTHORIZED", "missing auth", http.StatusUnauthorized)
		return
	}
	var req struct {
		Product string `json:"product"`
		Label   string `json:"label"`
	}
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	if req.Product == "" {
		req.Product = "api"
	}

	rawKey := generateAPIKey()
	hashed := sha256Hash(rawKey)
	prefix := rawKey[:12]
	id := "key_" + hex.EncodeToString(randomBytes(6))
	now := time.Now().UTC()

	_, err := h.db.ExecContext(r.Context(), `
		INSERT INTO api_credentials
		(id, tenant_id, product, key_prefix, hashed_key, rate_limit, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, claims.TenantID, req.Product, prefix, hashed, 1000, now)
	if err != nil {
		Error(w, "DB_ERROR", "create failed", http.StatusInternalServerError)
		return
	}

	// Return full key ONCE — never stored or shown again
	Success(w, map[string]interface{}{
		"id":      id,
		"key":     rawKey,
		"prefix":  prefix,
		"product": req.Product,
		"label":   req.Label,
		"message": "Save this key — it won't be shown again",
	}, http.StatusCreated)
}

// ListKeys returns all keys for the caller's tenant (prefix only).
func (h *SelfKeyHandler) ListKeys(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "UNAUTHORIZED", "missing auth", http.StatusUnauthorized)
		return
	}
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, product, key_prefix, rate_limit, created_at, revoked_at
		FROM api_credentials WHERE tenant_id = $1
		ORDER BY created_at DESC
	`, claims.TenantID)
	if err != nil {
		Error(w, "DB_ERROR", "query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var keys []map[string]interface{}
	for rows.Next() {
		var id, product, prefix string
		var rateLimit int
		var createdAt time.Time
		var revokedAt sql.NullTime
		rows.Scan(&id, &product, &prefix, &rateLimit, &createdAt, &revokedAt)
		keys = append(keys, map[string]interface{}{
			"id": id, "product": product, "prefix": prefix + "...",
			"rate_limit": rateLimit, "created_at": createdAt,
			"revoked": revokedAt.Valid,
		})
	}
	Success(w, map[string]interface{}{"keys": keys, "total": len(keys)}, http.StatusOK)
}

// RevokeKey revokes a key owned by the caller's tenant.
func (h *SelfKeyHandler) RevokeKey(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "UNAUTHORIZED", "missing auth", http.StatusUnauthorized)
		return
	}
	keyID := PathParam(r, "id")
	_, err := h.db.ExecContext(r.Context(), `
		UPDATE api_credentials SET revoked_at = NOW()
		WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL
	`, keyID, claims.TenantID)
	if err != nil {
		Error(w, "DB_ERROR", "revoke failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]string{"id": keyID, "status": "revoked"}, http.StatusOK)
}

func generateAPIKey() string {
	return "aegis_sk_" + hex.EncodeToString(randomBytes(24))
}

func sha256Hash(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

func randomBytes(n int) []byte {
	b := make([]byte, n)
	rand.Read(b)
	return b
}
