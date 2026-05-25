package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

// PromoRequest accepts both snake_case and camelCase for resilience.
type PromoRequest struct {
	Code        string `json:"code"`
	Product     string `json:"product,omitempty"`
	ProductCase string `json:"Product,omitempty"`
}

type PromoResponse struct {
	Code            string `json:"code"`
	DiscountPercent int    `json:"discount_percent"`
	DurationMonths  int    `json:"duration_months"`
	Valid           bool   `json:"valid"`
	Message         string `json:"message"`
}

// handlePromoCode validates a promo code and returns discount details.
// POST /api/v1/billing/promo  body: {code, product?}
func handlePromoCode(w http.ResponseWriter, r *http.Request) {
	var req PromoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, "INVALID_REQUEST", "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Code == "" {
		Error(w, "MISSING_CODE", "promo code required", http.StatusBadRequest)
		return
	}

	product := domain.ProductAPI
	productStr := req.Product
	if productStr == "" {
		productStr = req.ProductCase
	}
	if productStr != "" {
		if p, err := domain.ParseProduct(productStr); err == nil {
			product = p
		}
	}

	promo, err := billing.ValidatePromoCode(req.Code, product)
	if err != nil {
		Success(w, PromoResponse{
			Code:    req.Code,
			Valid:   false,
			Message: err.Error(),
		}, http.StatusOK)
		return
	}

	Success(w, PromoResponse{
		Code:            promo.Code,
		DiscountPercent: promo.DiscountPercent,
		DurationMonths:  promo.DurationMonths,
		Valid:           true,
		Message:         "Promo code valid",
	}, http.StatusOK)
}
