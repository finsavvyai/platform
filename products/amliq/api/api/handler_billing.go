package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

func handleBillingSubscriptions(billingSvc *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantIDStr := GetTenantID(r)
		if tenantIDStr == "" {
			Error(w, "MISSING_TENANT", "tenant_id required", http.StatusBadRequest)
			return
		}
		tenantID, err := domain.NewTenantID(tenantIDStr)
		if err != nil {
			Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
			return
		}

		subs, err := billingSvc.GetSubscriptions(r.Context(), tenantID)
		if err != nil {
			Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
			return
		}
		if subs == nil {
			subs = []domain.Subscription{}
		}

		items := make([]map[string]interface{}, len(subs))
		for i, s := range subs {
			items[i] = map[string]interface{}{
				"id":         s.ID,
				"product":    string(s.Product),
				"plan_id":    s.PlanID,
				"status":     s.Status.String(),
				"active":     s.IsActive(),
				"seat_count": s.SeatCount,
			}
		}
		Success(w, map[string]interface{}{"subscriptions": items}, http.StatusOK)
	}
}

func handleBillingInvoices(billingSvc *billing.BillingService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenantIDStr := GetTenantID(r)
		if tenantIDStr == "" {
			Error(w, "MISSING_TENANT", "tenant_id required", http.StatusBadRequest)
			return
		}
		tenantID, err := domain.NewTenantID(tenantIDStr)
		if err != nil {
			Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
			return
		}

		invoices, err := billingSvc.GetInvoices(r.Context(), tenantID)
		if err != nil {
			Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
			return
		}
		if invoices == nil {
			invoices = []domain.Invoice{}
		}
		Success(w, map[string]interface{}{"invoices": invoices}, http.StatusOK)
	}
}
