package api

import (
	"context"
	"net/http"
)

const TenantContextKey = "tenant_id"

func TenantMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.Header.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = QueryParam(r, "tenant_id")
		}

		if tenantID == "" {
			Error(w, "MISSING_TENANT", "tenant_id required", http.StatusBadRequest)
			return
		}

		ctx := context.WithValue(r.Context(), TenantContextKey, tenantID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetTenantID(r *http.Request) string {
	val := r.Context().Value(TenantContextKey)
	if val == nil {
		return ""
	}
	return val.(string)
}
