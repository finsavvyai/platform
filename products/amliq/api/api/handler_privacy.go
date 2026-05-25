package api

import (
	"database/sql"
	"net/http"

	"github.com/aegis-aml/aegis/internal/gdpr"
)

// PrivacyHandler exposes GDPR data-subject endpoints. Each call is
// authenticated, tenant-scoped, and audit-logged via the gdpr package.
type PrivacyHandler struct {
	db *sql.DB
}

func NewPrivacyHandler(db *sql.DB) *PrivacyHandler {
	return &PrivacyHandler{db: db}
}

type erasureRequest struct {
	CustomerID string `json:"customer_id"`
}

// Erase implements POST /api/v1/privacy/erase. Body: {customer_id}.
// Tenant is derived from the JWT claim — never accepted from the
// request body, otherwise one tenant could trigger deletion in
// another. Admin role required.
func (h *PrivacyHandler) Erase(w http.ResponseWriter, r *http.Request) {
	if h.db == nil {
		Error(w, "UNAVAILABLE", "privacy endpoint requires DB",
			http.StatusServiceUnavailable)
		return
	}
	claims, ok := ClaimsFromContext(r.Context())
	if !ok || claims.TenantID == "" {
		Error(w, "UNAUTHORIZED", "auth required",
			http.StatusUnauthorized)
		return
	}
	if claims.Role != "admin" && claims.Role != "owner" {
		Error(w, "FORBIDDEN", "admin role required",
			http.StatusForbidden)
		return
	}
	var req erasureRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID_REQUEST", "bad json",
			http.StatusBadRequest)
		return
	}
	if req.CustomerID == "" {
		Error(w, "VALIDATION", "customer_id required",
			http.StatusBadRequest)
		return
	}
	report, err := gdpr.EraseCustomerData(
		r.Context(), h.db, claims.TenantID, req.CustomerID)
	if err != nil {
		Error(w, "ERASURE_FAILED", err.Error(),
			http.StatusInternalServerError)
		return
	}
	Success(w, report, http.StatusOK)
}
