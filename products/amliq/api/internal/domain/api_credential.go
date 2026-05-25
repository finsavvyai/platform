package domain

import (
	"encoding/json"
	"fmt"
	"time"
)

type APICredential struct {
	ID          string
	TenantID    string
	Product     Product
	KeyPrefix   string
	HashedKey   string
	Scopes      []string
	IPAllowlist []string
	RateLimit   int
	ExpiresAt   *time.Time
	CreatedAt   time.Time
}

func NewAPICredential(tenantID string, product Product, scopes []string) (APICredential, error) {
	if tenantID == "" || !product.IsValid() {
		return APICredential{}, fmt.Errorf("invalid tenant or product")
	}
	prefix := prefixForProduct(product)
	return APICredential{
		ID:          generateID(),
		TenantID:    tenantID,
		Product:     product,
		KeyPrefix:   prefix,
		Scopes:      scopes,
		IPAllowlist: []string{},
		RateLimit:   0,
		CreatedAt:   time.Now().UTC(),
	}, nil
}

func prefixForProduct(p Product) string {
	switch p {
	case ProductAPI:
		return "aegis_api_sk_"
	case ProductSDK:
		return "aegis_sdk_sk_"
	case ProductIFrame:
		return "aegis_iframe_pk_"
	case ProductDataset:
		return "aegis_csv_sk_"
	case ProductDashboard:
		return "aegis_dash_sk_"
	}
	return "aegis_unknown_"
}

func (ac APICredential) IsExpired() bool {
	if ac.ExpiresAt == nil {
		return false
	}
	return time.Now().UTC().After(*ac.ExpiresAt)
}

func (ac APICredential) HasScope(scope string) bool {
	for _, s := range ac.Scopes {
		if s == scope {
			return true
		}
	}
	return false
}

func (ac APICredential) MarshalJSON() ([]byte, error) {
	type Alias APICredential
	return json.Marshal(&struct {
		*Alias
		ExpiresAt *time.Time `json:"expires_at"`
	}{
		Alias:     (*Alias)(&ac),
		ExpiresAt: ac.ExpiresAt,
	})
}
