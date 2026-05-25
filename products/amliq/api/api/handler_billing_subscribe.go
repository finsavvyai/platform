package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

type CheckoutRequest struct {
	Product          string `json:"product"`
	PlanID           string `json:"plan_id"`
	PlanIDCamel      string `json:"planId,omitempty"`
	PromoCode        string `json:"promo_code"`
	PromoCodeCamel   string `json:"promoCode,omitempty"`
	BillingPeriod    string `json:"billing_period"`
	BillingPeriodCam string `json:"billingPeriod,omitempty"`
	SuccessURL       string `json:"success_url"`
	SuccessURLCamel  string `json:"successUrl,omitempty"`
	CancelURL        string `json:"cancel_url"`
	CancelURLCamel   string `json:"cancelUrl,omitempty"`
}

func coalesce(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func handleCheckout(billingSvc *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		tenantIDStr := GetTenantID(req)
		if tenantIDStr == "" {
			Error(w, "MISSING_TENANT", "tenant_id required", http.StatusBadRequest)
			return
		}
		tenantID, err := domain.NewTenantID(tenantIDStr)
		if err != nil {
			Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
			return
		}

		var cr CheckoutRequest
		if err := json.NewDecoder(req.Body).Decode(&cr); err != nil {
			Error(w, "INVALID_REQUEST", "invalid request body", http.StatusBadRequest)
			return
		}

		product, err := domain.ParseProduct(cr.Product)
		if err != nil {
			Error(w, "INVALID_PRODUCT", err.Error(), http.StatusBadRequest)
			return
		}

		billingReq := billing.CheckoutRequest{
			Product:       product,
			PlanID:        coalesce(cr.PlanID, cr.PlanIDCamel),
			PromoCode:     coalesce(cr.PromoCode, cr.PromoCodeCamel),
			BillingPeriod: coalesce(cr.BillingPeriod, cr.BillingPeriodCam),
			SuccessURL:    coalesce(cr.SuccessURL, cr.SuccessURLCamel),
			CancelURL:     coalesce(cr.CancelURL, cr.CancelURLCamel),
		}

		url, err := billingSvc.CreateCheckout(req.Context(), tenantID, billingReq)
		if err != nil {
			Error(w, "CHECKOUT_ERROR", err.Error(), http.StatusBadRequest)
			return
		}

		Success(w, map[string]string{"checkout_url": url}, http.StatusOK)
	}
}
