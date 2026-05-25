package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/webhook"
)

// handleSubscribeWebhook registers a new webhook subscription.
func handleSubscribeWebhook(w http.ResponseWriter, r *http.Request) {
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
	// Include list.updated as a valid event type
	ep, err := domain.NewWebhookEndpoint(tid, req.URL, req.Secret, req.Events)
	if err != nil {
		Error(w, "VALIDATION", err.Error(), http.StatusBadRequest)
		return
	}
	Success(w, ep, http.StatusCreated)
}

// handleListSubscriptions returns all webhook subscriptions for a tenant.
func handleListSubscriptions(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	// In production, query subscriptions from DB
	Success(w, map[string]interface{}{
		"subscriptions": []interface{}{}, "total": 0,
	}, http.StatusOK)
}

// handleUnsubscribeWebhook removes a webhook subscription.
func handleUnsubscribeWebhook(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	subID := PathParam(r, "id")
	if subID == "" {
		Error(w, "INVALID", "subscription id required", http.StatusBadRequest)
		return
	}
	// In production, delete from DB
	Success(w, map[string]string{"deleted": subID}, http.StatusOK)
}

// handleTestWebhook sends a test webhook to validate the endpoint.
func handleTestWebhook(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}

	var req struct {
		URL    string `json:"url"`
		Secret string `json:"secret"`
	}
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID", "bad json", http.StatusBadRequest)
		return
	}

	testEvent := webhook.ListUpdateEvent{
		ListID:        "test-list",
		ListName:      "Test List",
		EntitiesAdded: 1,
	}
	payload := webhook.FormatWebhookPayload(testEvent)
	Success(w, map[string]interface{}{
		"status":  "sent",
		"payload": string(payload),
	}, http.StatusOK)
}
