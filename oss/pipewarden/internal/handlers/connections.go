package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// TestAllConnections handles POST /api/v1/connections/test
func (h *Handlers) TestAllConnections(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	results := h.manager.TestAllConnections(ctx)
	for name, status := range results {
		if status == nil {
			continue
		}
		if err := h.db.UpdateConnectionHealth(name, healthStatus(status.Connected), status.User, time.Now().UTC()); err != nil {
			h.logger.Warnw("failed to update connection health", "name", name, "error", err)
		}
	}
	jsonOK(w, results)
}

// TestConnection handles POST /api/v1/connections/{name}/test
func (h *Handlers) TestConnection(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/connections/")
	parts := strings.SplitN(path, "/", 2)
	name := parts[0]

	if name == "" || len(parts) != 2 || parts[1] != "test" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	status, err := h.manager.TestConnection(ctx, name)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	if err := h.db.UpdateConnectionHealth(name, healthStatus(status.Connected), status.User, time.Now().UTC()); err != nil {
		h.logger.Warnw("failed to update connection health", "name", name, "error", err)
	}

	jsonOK(w, status)
}

func healthStatus(connected bool) string {
	if connected {
		return "connected"
	}
	return "error"
}

// UpdateConnection handles PUT /api/v1/connections/update
func (h *Handlers) UpdateConnection(w http.ResponseWriter, r *http.Request) {
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

	if req.Name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}

	existing, err := h.db.GetByName(req.Name)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}

	// Decrypt existing credentials for fallback/merge
	if err := h.DecryptCredentials(existing); err != nil {
		jsonError(w, err.Error(), vaultErrorStatus(err))
		return
	}

	if req.Platform == "" {
		req.Platform = existing.Platform
	}
	if req.Token == "" {
		req.Token = existing.Token
	}
	if req.Username == "" {
		req.Username = existing.Username
	}
	if req.AppPassword == "" {
		req.AppPassword = existing.AppPassword
	}
	if req.BaseURL == "" {
		req.BaseURL = existing.BaseURL
	}

	rec := &storage.ConnectionRecord{
		Name:             req.Name,
		Platform:         req.Platform,
		AuthMethod:       existing.AuthMethod,
		Token:            req.Token,
		Username:         req.Username,
		AppPassword:      req.AppPassword,
		BaseURL:          req.BaseURL,
		ProviderIdentity: existing.ProviderIdentity,
		InstallationID:   existing.InstallationID,
		CredentialRef:    existing.CredentialRef,
		HealthStatus:     existing.HealthStatus,
		LastVerifiedAt:   existing.LastVerifiedAt,
	}

	// Encrypt new credentials before storage
	if err := h.EncryptCredentials(rec); err != nil {
		jsonError(w, err.Error(), vaultErrorStatus(err))
		return
	}

	if err := h.db.Update(rec); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	provider := buildProvider(req.Platform, existing.AuthMethod, req.Token, req.Username, req.AppPassword, req.BaseURL, h.cfg, h.logger)
	if provider != nil {
		h.manager.Replace(req.Name, provider)
	}

	jsonOK(w, map[string]string{"name": req.Name, "status": "updated"})
}
