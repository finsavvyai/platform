package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/storage"
)

// PlatformUserHandler lists users. Scoped to caller's tenant.
type PlatformUserHandler struct {
	users   storage.UserRepository
	tenants storage.TenantRepository
}

func NewPlatformUserHandler(
	u storage.UserRepository, t storage.TenantRepository,
) *PlatformUserHandler {
	return &PlatformUserHandler{users: u, tenants: t}
}

// ListAllUsers returns users for the caller's tenant only.
func (h *PlatformUserHandler) ListAllUsers(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "UNAUTHORIZED", "missing auth", http.StatusUnauthorized)
		return
	}
	users, err := h.users.ListAll(r.Context())
	if err != nil {
		Error(w, "DB_ERROR", "list users failed", http.StatusInternalServerError)
		return
	}
	// Scope to caller's tenant
	var scoped []map[string]string
	for _, u := range users {
		if u.TenantID != claims.TenantID {
			continue
		}
		scoped = append(scoped, map[string]string{
			"id": u.ID, "email": u.Email,
			"role": u.Role, "name": u.Name,
		})
	}
	Success(w, map[string]interface{}{
		"users": scoped, "total": len(scoped),
	}, http.StatusOK)
}
