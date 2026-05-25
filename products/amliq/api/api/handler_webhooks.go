package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func handleCreateWebhook(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	tid, _ := domain.NewTenantID(tenantID)

	var req struct {
		URL    string                    `json:"url"`
		Secret string                    `json:"secret"`
		Events []domain.WebhookEventType `json:"events"`
	}
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}
	ep, err := domain.NewWebhookEndpoint(tid, req.URL, req.Secret, req.Events)
	if err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}
	// In production, persist to DB
	Success(w, ep, http.StatusCreated)
}

func handleListWebhooks(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	// In production, query from DB
	Success(w, map[string]interface{}{
		"webhooks": []interface{}{}, "total": 0,
	}, http.StatusOK)
}
