package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/billing"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

// CheckoutRequest represents a billing checkout request.
type CheckoutRequest struct {
	Plan     string `json:"plan"`
	TenantID string `json:"tenant_id,omitempty"`
	Email    string `json:"email,omitempty"`
}

// CreateCheckoutSession handles POST /api/v1/billing/checkout.
// Billing remains optional; without LemonSqueezy credentials the app stays in trial mode.
func (h *Handlers) CreateCheckoutSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CheckoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Plan == "" {
		jsonError(w, "plan is required", http.StatusBadRequest)
		return
	}

	validPlans := map[string]bool{
		"community":       true,
		"starter":         true,
		"team":            true,
		"professional":    true,
		"enterprise":      true,
		"enterprise_plus": true,
	}
	if !validPlans[req.Plan] {
		jsonError(w, "invalid plan: must be community, starter, team, professional, enterprise, or enterprise_plus", http.StatusBadRequest)
		return
	}

	if req.TenantID == "" {
		req.TenantID = "local-eval"
	}

	response := map[string]interface{}{
		"plan":            req.Plan,
		"tenant_id":       req.TenantID,
		"created_at":      time.Now().UTC(),
		"billing_enabled": h.billingClient != nil && h.billingClient.Enabled(),
	}

	if req.Plan == "community" || h.billingClient == nil || !h.billingClient.Enabled() {
		response["session_id"] = "trial"
		response["trial_mode"] = true
		response["checkout_url"] = ""
		jsonOK(w, response)
		return
	}

	checkoutURL, err := h.billingClient.CreateCheckoutURL(req.TenantID, req.Plan, req.Email)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	response["session_id"] = "checkout"
	response["trial_mode"] = false
	response["checkout_url"] = checkoutURL
	jsonOK(w, response)
}

// HandleBillingWebhook handles POST /api/v1/billing/webhook.
// Processes LemonSqueezy webhook events for subscription lifecycle.
func (h *Handlers) HandleBillingWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.billingClient == nil || !h.billingClient.Enabled() {
		jsonError(w, "billing not configured", http.StatusServiceUnavailable)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		jsonError(w, "failed to read body", http.StatusBadRequest)
		return
	}

	sig := r.Header.Get("X-Signature")
	if sig == "" {
		jsonError(w, "missing signature", http.StatusUnauthorized)
		return
	}
	if !h.billingClient.VerifyWebhookSignature(body, sig) {
		jsonError(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	event, err := h.billingClient.ParseWebhookEvent(body)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	subscription := subscriptionFromEvent(event)
	if subscription != nil && h.db != nil {
		if err := h.db.UpsertSubscription(subscription); err != nil {
			h.logger.Errorw("failed to persist subscription state", "error", err)
			jsonError(w, "failed to persist subscription", http.StatusInternalServerError)
			return
		}
	}

	h.logger.Infow("billing webhook received", "event_name", event.Meta.EventName)
	jsonOK(w, map[string]interface{}{
		"received":   true,
		"event_name": event.Meta.EventName,
	})
}

func subscriptionFromEvent(event *billing.WebhookEvent) *storage.SubscriptionRecord {
	if event == nil {
		return nil
	}

	tenantID := tenantIDFromCustomData(event.Meta.CustomData)
	if tenantID == "" {
		return nil
	}

	tier := "community"
	eventLower := strings.ToLower(event.Meta.EventName)
	switch {
	case strings.Contains(eventLower, "enterprise_plus") || strings.Contains(eventLower, "enterprise-plus"):
		tier = "enterprise_plus"
	case strings.Contains(eventLower, "enterprise"):
		tier = "enterprise"
	case strings.Contains(eventLower, "professional"):
		tier = "professional"
	case strings.Contains(eventLower, "team"):
		tier = "team"
	case strings.Contains(eventLower, "starter"):
		tier = "starter"
	}

	status := event.Data.Attributes.Status
	if status == "" {
		switch event.Meta.EventName {
		case "subscription_cancelled":
			status = "cancelled"
		default:
			status = "active"
		}
	}

	rec := &storage.SubscriptionRecord{
		TenantID: tenantID,
		Tier:     tier,
		Status:   status,
	}
	if !event.Data.Attributes.RenewsAt.IsZero() {
		rec.RenewsAt = &event.Data.Attributes.RenewsAt
	}
	if status == "cancelled" {
		now := time.Now().UTC()
		rec.CancelledAt = &now
	}
	return rec
}

func tenantIDFromCustomData(customData interface{}) string {
	switch value := customData.(type) {
	case map[string]interface{}:
		if tenantID, ok := value["tenant_id"].(string); ok {
			return tenantID
		}
	case map[string]string:
		return value["tenant_id"]
	}
	return ""
}
