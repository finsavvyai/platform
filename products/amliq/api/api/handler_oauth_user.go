package api

import (
	"log"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
)

func (h *OAuthHandler) findOrCreateUser(
	r *http.Request, provider string, info oauthUserInfo,
) (*domain.User, error) {
	// 1. Check by provider ID (exact match)
	existing, _ := h.users.GetByProvider(r.Context(), provider, info.ID)
	if existing != nil {
		return existing, nil
	}
	// 2. Check by email (user might exist via different provider)
	existing, _ = h.users.GetByEmail(r.Context(), info.Email)
	if existing != nil {
		return existing, nil
	}
	// 3. Try to find existing tenant by name (avoid duplicate key)
	tenantID, err := h.findOrCreateTenant(info)
	if err != nil {
		return nil, err
	}
	// 4. Create user under the tenant
	user, err := domain.NewOAuthUser(
		tenantID, info.Email, provider, info.ID, info.Name)
	if err != nil {
		return nil, err
	}
	if err := h.users.Create(r.Context(), user); err != nil {
		return nil, err
	}
	return &user, nil
}

func (h *OAuthHandler) findOrCreateTenant(info oauthUserInfo) (string, error) {
	// Check if tenant with this name already exists
	existing, _ := h.tenants.GetByName(info.Email)
	if existing != nil {
		return existing.ID.String(), nil
	}
	// Create new tenant
	tenantID, err := domain.GenerateTenantID()
	if err != nil {
		return "", err
	}
	tenant, err := domain.NewTenant(tenantID, info.Email, info.Name)
	if err != nil {
		return "", err
	}
	if err := h.tenants.Create(tenant); err != nil {
		// If duplicate, try to find it again
		log.Printf("oauth: tenant create failed (likely duplicate): %v", err)
		existing, _ = h.tenants.GetByName(info.Email)
		if existing != nil {
			return existing.ID.String(), nil
		}
		return "", err
	}
	return tenantID.String(), nil
}
