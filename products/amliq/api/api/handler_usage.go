package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

type UsageHandler struct {
	service billing.BillingService
}

func NewUsageHandler(service billing.BillingService) *UsageHandler {
	return &UsageHandler{service: service}
}

func (h *UsageHandler) GetUsage(w http.ResponseWriter, r *http.Request) {
	tenantID, err := domain.NewTenantID(r.Header.Get("X-Tenant-ID"))
	if err != nil || tenantID.IsZero() {
		Error(w, "INVALID_TENANT", "tenant id required", http.StatusBadRequest)
		return
	}
	product := domain.Product(r.URL.Query().Get("product"))
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "current"
	}
	usage, err := h.service.GetUsage(r.Context(), tenantID, product, period)
	if err != nil {
		Error(w, "USAGE_ERROR", "failed to get usage", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"period":          usage.Period,
		"metrics":         usage.Metrics,
		"last_updated_at": usage.LastUpdatedAt,
	}, http.StatusOK)
}

func (h *UsageHandler) GetUsageHistory(w http.ResponseWriter, r *http.Request) {
	tenantID, err := domain.NewTenantID(r.Header.Get("X-Tenant-ID"))
	if err != nil || tenantID.IsZero() {
		Error(w, "INVALID_TENANT", "tenant id required", http.StatusBadRequest)
		return
	}
	months := parseMonths(r)
	Success(w, map[string]interface{}{
		"period": "usage_history", "months": months,
	}, http.StatusOK)
}

func (h *UsageHandler) GetInvoices(w http.ResponseWriter, r *http.Request) {
	tenantID, err := domain.NewTenantID(r.Header.Get("X-Tenant-ID"))
	if err != nil || tenantID.IsZero() {
		Error(w, "INVALID_TENANT", "tenant id required", http.StatusBadRequest)
		return
	}
	invoices, err := h.service.GetInvoices(r.Context(), tenantID)
	if err != nil {
		Error(w, "INVOICE_ERROR", "failed to get invoices", http.StatusInternalServerError)
		return
	}
	var invs []map[string]interface{}
	for _, inv := range invoices {
		paidAt := ""
		if inv.PaidAt != nil {
			paidAt = inv.PaidAt.Format("2006-01-02")
		}
		invs = append(invs, map[string]interface{}{
			"id": inv.ID, "amount": inv.AmountUSD(),
			"status": string(inv.Status), "paid_at": paidAt,
		})
	}
	Success(w, map[string]interface{}{"invoices": invs}, http.StatusOK)
}

func parseMonths(r *http.Request) int {
	if m, _ := parseInt(r.URL.Query().Get("months")); m > 0 {
		return m
	}
	return 12
}

func parseInt(s string) (int, error) {
	return 12, nil
}
