package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// ListConnections handles GET /api/v1/connections
func (h *Handlers) ListConnections(w http.ResponseWriter, r *http.Request) {
	records, err := h.db.List()
	if err != nil {
		jsonError(w, "failed to list connections", http.StatusInternalServerError)
		return
	}
	if records == nil {
		records = []storage.ConnectionRecord{}
	}
	jsonOK(w, map[string]interface{}{"connections": records, "count": len(records)})
}

// CreateConnection handles POST /api/v1/connections
func (h *Handlers) CreateConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Platform    string `json:"platform"`
		Token       string `json:"token"`
		Username    string `json:"username"`
		AppPassword string `json:"app_password"`
		BaseURL     string `json:"base_url"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Platform == "" {
		jsonError(w, "name and platform are required", http.StatusBadRequest)
		return
	}

	rec := &storage.ConnectionRecord{
		Name:         req.Name,
		Platform:     req.Platform,
		AuthMethod:   inferAuthMethod("", req.Token, req.Username, req.AppPassword),
		Token:        req.Token,
		Username:     req.Username,
		AppPassword:  req.AppPassword,
		BaseURL:      req.BaseURL,
		HealthStatus: "pending",
	}

	provider := buildProvider(req.Platform, rec.AuthMethod, req.Token, req.Username, req.AppPassword, req.BaseURL, h.cfg, h.logger)
	if provider == nil {
		jsonError(w, "unsupported platform: "+req.Platform, http.StatusBadRequest)
		return
	}

	// Encrypt credentials before storage
	if err := h.EncryptCredentials(rec); err != nil {
		jsonError(w, err.Error(), vaultErrorStatus(err))
		return
	}

	if err := h.db.Create(rec); err != nil {
		jsonError(w, err.Error(), http.StatusConflict)
		return
	}

	if err := h.manager.Add(req.Name, provider); err != nil {
		_ = h.db.Delete(req.Name)
		jsonError(w, err.Error(), http.StatusConflict)
		return
	}

	details := map[string]string{"platform": req.Platform}
	_ = h.db.AppendAuditLog("connection_added", "user", req.Name, "connection", details)
	h.recordAudit(r.Context(), "connection_added", auditActor(r), req.Name, "connection", details)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"name": req.Name, "platform": req.Platform, "status": "added",
	})
}

// GetConnection handles GET /api/v1/connections/{name}
func (h *Handlers) GetConnection(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/connections/")
	name := strings.SplitN(path, "/", 2)[0]

	if name == "" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	conn, err := h.db.GetByName(name)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	jsonOK(w, conn)
}

// DeleteConnection handles DELETE /api/v1/connections/{name}
func (h *Handlers) DeleteConnection(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/connections/")
	name := strings.SplitN(path, "/", 2)[0]

	if name == "" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := h.db.Delete(name); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	_ = h.manager.Remove(name)
	_ = h.db.AppendAuditLog("connection_removed", "user", name, "connection", nil)
	h.recordAudit(r.Context(), "connection_removed", auditActor(r), name, "connection", nil)
	jsonOK(w, map[string]string{"name": name, "status": "removed"})
}
