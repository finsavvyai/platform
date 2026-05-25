package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

func handleScreeningQuota(
	enforcer *billing.Enforcer,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if enforcer == nil {
			Success(w, billing.Quota{
				Used: 0, Limit: 100, Remaining: 100,
				PlanName: "Free Tier", HasSubscription: false,
			}, http.StatusOK)
			return
		}

		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			Error(w, "UNAUTHORIZED", "missing auth",
				http.StatusUnauthorized)
			return
		}

		tenantID, err := domain.NewTenantID(claims.TenantID)
		if err != nil {
			Error(w, "INVALID_TENANT", err.Error(),
				http.StatusBadRequest)
			return
		}

		quota, err := enforcer.GetQuota(
			r.Context(), tenantID,
			domain.ProductAPI, domain.MetricAPIScreenings,
		)
		if err != nil {
			Error(w, "DB_ERROR", "quota lookup failed",
				http.StatusInternalServerError)
			return
		}
		// Fill in free tier limits for unsubscribed users
		if !quota.HasSubscription {
			quota.Limit = int64(FreeTierScreeningsPerDay)
			quota.Remaining = int64(FreeTierScreeningsPerDay) - quota.Used
			if quota.Remaining < 0 {
				quota.Remaining = 0
			}
			quota.PlanName = "Free Tier"
		}
		Success(w, quota, http.StatusOK)
	}
}
