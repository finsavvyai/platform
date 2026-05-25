package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (h *AuthHandler) respondWithToken(w http.ResponseWriter, user *domain.User) {
	token, err := SignJWT(user.TenantID, user.ID, user.Role, h.secret, h.expiry)
	if err != nil {
		Error(w, "TOKEN_ERROR", "failed to create token", http.StatusInternalServerError)
		return
	}
	Success(w, map[string]interface{}{
		"token": token,
		"user": map[string]string{
			"id": user.ID, "email": user.Email,
			"role": user.Role, "tenant_id": user.TenantID,
		},
	}, http.StatusOK)
}

func (h *AuthHandler) createTenantAndUser(
	r *http.Request, orgName, country, email, password string,
) (domain.Tenant, domain.User, error) {
	// Check if user already exists
	existing, _ := h.users.GetByEmail(r.Context(), email)
	if existing != nil {
		return domain.Tenant{}, domain.User{},
			fmt.Errorf("email already registered")
	}

	// Try to find existing tenant by org name
	tenant, _ := h.tenants.GetByName(orgName)

	if tenant == nil {
		// Create new tenant
		tenantID, err := domain.GenerateTenantID()
		if err != nil {
			return domain.Tenant{}, domain.User{}, err
		}
		newTenant, err := domain.NewTenant(tenantID, orgName, orgName)
		if err != nil {
			return domain.Tenant{}, domain.User{}, err
		}
		if err := h.tenants.Create(newTenant); err != nil {
			if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "23505") {
				return domain.Tenant{}, domain.User{},
					fmt.Errorf("organization name already taken")
			}
			return domain.Tenant{}, domain.User{}, err
		}
		tenant = &newTenant
	}

	user, err := domain.NewUser(
		tenant.ID.String(), email, password, "admin",
	)
	if err != nil {
		return domain.Tenant{}, domain.User{}, err
	}
	if err := h.users.Create(r.Context(), user); err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "23505") {
			return domain.Tenant{}, domain.User{},
				fmt.Errorf("email already registered")
		}
		return domain.Tenant{}, domain.User{}, err
	}
	return *tenant, user, nil
}
