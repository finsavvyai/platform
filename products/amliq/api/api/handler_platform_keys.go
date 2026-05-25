package api

import (
	"database/sql"
	"net/http"
)

// PlatformKeyHandler manages API credentials platform-wide.
type PlatformKeyHandler struct {
	db *sql.DB
}

func NewPlatformKeyHandler(db *sql.DB) *PlatformKeyHandler {
	return &PlatformKeyHandler{db: db}
}

// ListAllKeys returns all API credentials across tenants.
func (h *PlatformKeyHandler) ListAllKeys(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT id, tenant_id, product, key_prefix,
		       rate_limit, expires_at, created_at
		FROM api_credentials ORDER BY created_at DESC`)
	if err != nil {
		Error(w, "DB_ERROR", "query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type keyEntry struct {
		ID        string      `json:"id"`
		TenantID  string      `json:"tenant_id"`
		Product   string      `json:"product"`
		KeyPrefix string      `json:"key_prefix"`
		RateLimit int         `json:"rate_limit"`
		ExpiresAt interface{} `json:"expires_at"`
		CreatedAt interface{} `json:"created_at"`
	}
	var keys []keyEntry
	for rows.Next() {
		var k keyEntry
		if err := rows.Scan(&k.ID, &k.TenantID, &k.Product,
			&k.KeyPrefix, &k.RateLimit,
			&k.ExpiresAt, &k.CreatedAt); err != nil {
			continue
		}
		keys = append(keys, k)
	}
	Success(w, map[string]interface{}{
		"api_keys": keys, "total": len(keys),
	}, http.StatusOK)
}

// RevokeKey disables an API credential.
func (h *PlatformKeyHandler) RevokeKey(w http.ResponseWriter, r *http.Request) {
	keyID := PathParam(r, "id")
	if keyID == "" {
		Error(w, "MISSING_PARAM", "key id required", http.StatusBadRequest)
		return
	}
	_, err := h.db.ExecContext(r.Context(),
		`UPDATE api_credentials SET revoked_at=NOW() WHERE id=$1`, keyID)
	if err != nil {
		Error(w, "DB_ERROR", "revoke failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]string{"status": "revoked"}, http.StatusOK)
}
