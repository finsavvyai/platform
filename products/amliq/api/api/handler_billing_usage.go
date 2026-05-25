package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

func handleBillingUsage(billingSvc *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		tenantIDStr := GetTenantID(req)
		if tenantIDStr == "" {
			Error(w, "UNAUTHORIZED", "tenant_id required", http.StatusUnauthorized)
			return
		}
		tenantID, err := domain.NewTenantID(tenantIDStr)
		if err != nil {
			Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
			return
		}

		product := req.URL.Query().Get("product")
		period := billing.CurrentPeriod()

		if product == "" {
			handleAllProductUsage(w, req, billingSvc, tenantID, period)
			return
		}

		prod, err := domain.ParseProduct(product)
		if err != nil {
			Error(w, "INVALID_PRODUCT", err.Error(), http.StatusBadRequest)
			return
		}

		rec, err := billingSvc.GetUsage(req.Context(), tenantID, prod, period)
		if err != nil {
			Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
			return
		}
		Success(w, map[string]interface{}{
			"product": string(prod),
			"period":  period,
			"metrics": rec.Metrics,
		}, http.StatusOK)
	}
}

func handleAllProductUsage(
	w http.ResponseWriter, req *http.Request,
	svc *billing.BillingService, tenantID domain.TenantID, period string,
) {
	usage := make(map[string]interface{})
	for _, prod := range domain.AllProducts() {
		rec, err := svc.GetUsage(req.Context(), tenantID, prod, period)
		if err != nil {
			usage[string(prod)] = map[string]interface{}{}
			continue
		}
		usage[string(prod)] = rec.Metrics
	}
	Success(w, map[string]interface{}{"usage": usage}, http.StatusOK)
}
