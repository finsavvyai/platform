package api

import (
	"encoding/json"
	"net/http"
	"sync"
)

// AlertConfig defines notification preferences for task failures.
type AlertConfig struct {
	Email    string `json:"email,omitempty"`
	WhatsApp string `json:"whatsapp,omitempty"`
	Slack    string `json:"slack_webhook,omitempty"`
	Enabled  bool   `json:"enabled"`
}

// AlertConfigStore holds per-tenant alert configurations in memory.
type AlertConfigStore struct {
	mu      sync.RWMutex
	configs map[string]AlertConfig // tenant_id → config
}

func NewAlertConfigStore() *AlertConfigStore {
	return &AlertConfigStore{configs: make(map[string]AlertConfig)}
}

func (s *AlertConfigStore) Get(tenantID string) AlertConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.configs[tenantID]
}

func (s *AlertConfigStore) Set(tenantID string, cfg AlertConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.configs[tenantID] = cfg
}

// TaskAlertHandler manages alert configuration for task failures.
type TaskAlertHandler struct {
	store *AlertConfigStore
}

func NewTaskAlertHandler(store *AlertConfigStore) *TaskAlertHandler {
	return &TaskAlertHandler{store: store}
}

// GetConfig returns the tenant's alert configuration.
func (h *TaskAlertHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "MISSING_TENANT", "tenant_id required", http.StatusBadRequest)
		return
	}
	cfg := h.store.Get(tenantID)
	Success(w, cfg, http.StatusOK)
}

// UpdateConfig saves alert notification preferences.
func (h *TaskAlertHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "MISSING_TENANT", "tenant_id required", http.StatusBadRequest)
		return
	}
	var cfg AlertConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		Error(w, "INVALID_BODY", err.Error(), http.StatusBadRequest)
		return
	}
	h.store.Set(tenantID, cfg)
	Success(w, cfg, http.StatusOK)
}
