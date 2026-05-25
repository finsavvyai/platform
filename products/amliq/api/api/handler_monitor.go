package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// MonitorProfileHandler handles monitor profile CRUD.
type MonitorProfileHandler struct {
	profiles storage.MonitorProfileRepository
}

// NewMonitorProfileHandler creates a profile handler.
func NewMonitorProfileHandler(p storage.MonitorProfileRepository) *MonitorProfileHandler {
	return &MonitorProfileHandler{profiles: p}
}

// CreateProfileRequest is the JSON body for adding a profile.
type CreateProfileRequest struct {
	EntityName string   `json:"entity_name"`
	EntityType string   `json:"entity_type"`
	RiskLevel  string   `json:"risk_level"`
	Frequency  string   `json:"frequency"`
	Lists      []string `json:"lists"`
}

// Create adds an entity to ongoing monitoring.
func (h *MonitorProfileHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	var req CreateProfileRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	entType, _ := domain.ParseEntityType(req.EntityType)
	profile, err := domain.NewMonitorProfile(tid, req.EntityName, entType, domain.RiskLevel(req.RiskLevel))
	if err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}
	if req.Frequency != "" {
		freq, _ := domain.ParseFrequency(req.Frequency)
		profile.Frequency = freq
	}
	if len(req.Lists) > 0 {
		profile.ListsToScreen = req.Lists
	}
	if err := h.profiles.Create(r.Context(), profile); err != nil {
		Error(w, "DB_ERROR", "create failed", http.StatusInternalServerError)
		return
	}
	Success(w, profile, http.StatusCreated)
}

// List returns all monitored profiles for the tenant.
func (h *MonitorProfileHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)
	profiles, err := h.profiles.ListByTenant(r.Context(), tid)
	if err != nil {
		Error(w, "DB_ERROR", "list failed", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"profiles": profiles, "total": len(profiles),
	}, http.StatusOK)
}
