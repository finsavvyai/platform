package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/queryflux/backend/internal/services"
	"go.uber.org/zap"
)

// BillingHandler handles billing-related HTTP requests
type BillingHandler struct {
	lemonSqueezy *services.LemonSqueezyService
	logger       *zap.Logger
}

// NewBillingHandler creates a new billing handler
func NewBillingHandler(lemonSqueezy *services.LemonSqueezyService, logger *zap.Logger) *BillingHandler {
	return &BillingHandler{
		lemonSqueezy: lemonSqueezy,
		logger:       logger,
	}
}

// CheckoutRequest represents a checkout creation request
type CheckoutRequest struct {
	VariantID     string `json:"variant_id"`
	CustomerEmail string `json:"customer_email"`
	UserID        string `json:"user_id,omitempty"`
}

// CheckoutResponse represents checkout creation response
type CheckoutResponse struct {
	Success     bool   `json:"success"`
	CheckoutURL string `json:"checkout_url,omitempty"`
	Error       string `json:"error,omitempty"`
}

// CreateCheckout handles POST /api/billing/checkout
func (h *BillingHandler) CreateCheckout(w http.ResponseWriter, r *http.Request) {
	var req CheckoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.VariantID == "" {
		h.respondError(w, "variant_id is required", http.StatusBadRequest)
		return
	}

	checkoutReq := services.CheckoutRequest{
		VariantID:     req.VariantID,
		CustomerEmail: req.CustomerEmail,
		CustomData: map[string]string{
			"user_id": req.UserID,
		},
	}

	resp, err := h.lemonSqueezy.CreateCheckout(r.Context(), checkoutReq)
	if err != nil {
		h.logger.Error("Failed to create checkout", zap.Error(err))
		h.respondError(w, "Failed to create checkout", http.StatusInternalServerError)
		return
	}

	h.respondJSON(w, CheckoutResponse{
		Success:     true,
		CheckoutURL: resp.Data.Attributes.URL,
	})
}

// LicenseValidationRequest represents a license validation request
type LicenseValidationRequest struct {
	LicenseKey string `json:"license_key"`
}

// LicenseValidationResponse represents license validation response
type LicenseValidationResponse struct {
	Valid    bool                       `json:"valid"`
	License  *services.SubscriptionTier `json:"license,omitempty"`
	Features *services.Features         `json:"features,omitempty"`
	Error    string                     `json:"error,omitempty"`
}

// ValidateLicense handles POST /api/billing/validate-license
func (h *BillingHandler) ValidateLicense(w http.ResponseWriter, r *http.Request) {
	var req LicenseValidationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.LicenseKey == "" {
		h.respondError(w, "license_key is required", http.StatusBadRequest)
		return
	}

	resp, err := h.lemonSqueezy.ValidateLicense(r.Context(), req.LicenseKey)
	if err != nil {
		h.logger.Error("Failed to validate license", zap.Error(err))
		h.respondError(w, "Failed to validate license", http.StatusInternalServerError)
		return
	}

	if !resp.Valid {
		h.respondJSON(w, LicenseValidationResponse{
			Valid: false,
			Error: "Invalid or expired license key",
		})
		return
	}

	// Map variant to subscription tier
	tier := h.getTierFromVariant(resp.LicenseDetails.VariantName)

	h.respondJSON(w, LicenseValidationResponse{
		Valid:    true,
		License:  tier,
		Features: &tier.Features,
	})
}

// GetTiers handles GET /api/billing/tiers
func (h *BillingHandler) GetTiers(w http.ResponseWriter, r *http.Request) {
	tiers := services.GetSubscriptionTiers()
	h.respondJSON(w, map[string]interface{}{
		"tiers": tiers,
	})
}

// SubscriptionStatusResponse represents subscription status response
type SubscriptionStatusResponse struct {
	Active         bool                    `json:"active"`
	Tier           *services.SubscriptionTier `json:"tier,omitempty"`
	ExpiresAt      string                  `json:"expires_at,omitempty"`
	RenewalDate    string                  `json:"renewal_date,omitempty"`
	CancelledAt    string                  `json:"cancelled_at,omitempty"`
	PaymentFailed  bool                    `json:"payment_failed"`
}

// GetSubscriptionStatus handles GET /api/billing/subscription/:id
func (h *BillingHandler) GetSubscriptionStatus(w http.ResponseWriter, r *http.Request) {
	subscriptionID := r.URL.Query().Get("id")
	if subscriptionID == "" {
		h.respondError(w, "subscription id is required", http.StatusBadRequest)
		return
	}

	details, err := h.lemonSqueezy.GetSubscriptionDetails(r.Context(), subscriptionID)
	if err != nil {
		h.logger.Error("Failed to get subscription details", zap.Error(err))
		h.respondError(w, "Failed to get subscription status", http.StatusInternalServerError)
		return
	}

	h.respondJSON(w, details)
}

// CancelSubscription handles POST /api/billing/subscription/:id/cancel
func (h *BillingHandler) CancelSubscription(w http.ResponseWriter, r *http.Request) {
	subscriptionID := r.URL.Query().Get("id")
	if subscriptionID == "" {
		h.respondError(w, "subscription id is required", http.StatusBadRequest)
		return
	}

	if err := h.lemonSqueezy.CancelSubscription(r.Context(), subscriptionID); err != nil {
		h.logger.Error("Failed to cancel subscription", zap.Error(err))
		h.respondError(w, "Failed to cancel subscription", http.StatusInternalServerError)
		return
	}

	h.respondJSON(w, map[string]interface{}{
		"success": true,
		"message": "Subscription cancelled successfully",
	})
}

// getTierFromVariant maps LemonSqueezy variant name to subscription tier
func (h *BillingHandler) getTierFromVariant(variantName string) *services.SubscriptionTier {
	tiers := services.GetSubscriptionTiers()
	for _, tier := range tiers {
		if tier.Name == variantName || tier.ID == variantName {
			return &tier
		}
	}
	// Return starter tier as default
	starter := tiers[0]
	return &starter
}

// Helper methods
func (h *BillingHandler) respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func (h *BillingHandler) respondError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   message,
	})
}
