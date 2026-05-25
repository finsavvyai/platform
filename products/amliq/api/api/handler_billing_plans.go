package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

func handleBillingPlans(w http.ResponseWriter, req *http.Request) {
	product := req.URL.Query().Get("product")
	var plans []domain.Plan

	if product != "" {
		prod, err := domain.ParseProduct(product)
		if err != nil {
			Error(w, "INVALID_PRODUCT", err.Error(), http.StatusBadRequest)
			return
		}
		plans = billing.GetPlansForProduct(prod)
	} else {
		plans = billing.AllPlans()
	}

	Success(w, map[string]interface{}{"plans": plans}, http.StatusOK)
}
