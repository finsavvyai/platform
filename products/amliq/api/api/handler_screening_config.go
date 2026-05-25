package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func handleGetScreeningConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	if _, err := domain.NewTenantID(tenantID); err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}
	// In production, load from storage; for now return default.
	cfg := domain.DefaultScreeningConfig()
	Success(w, cfg, http.StatusOK)
}

func handleUpdateScreeningConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	if _, err := domain.NewTenantID(tenantID); err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	var cfg domain.ScreeningConfig
	if err := DecodeJSON(r, &cfg); err != nil {
		Error(w, "INVALID_REQUEST", "bad json", http.StatusBadRequest)
		return
	}
	if err := domain.ValidateConfig(cfg); err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}

	Success(w, map[string]interface{}{
		"message": "screening config updated",
		"config":  cfg,
	}, http.StatusOK)
}

func handleResetScreeningConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	if _, err := domain.NewTenantID(tenantID); err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	cfg := domain.DefaultScreeningConfig()
	Success(w, map[string]interface{}{
		"message": "screening config reset to defaults",
		"config":  cfg,
	}, http.StatusOK)
}
