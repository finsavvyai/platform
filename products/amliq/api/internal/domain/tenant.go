package domain

import (
	"fmt"
	"time"
)

type Tenant struct {
	ID          TenantID
	Name        string
	DisplayName string
	Config      TenantConfig
	Suspended   bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func NewTenant(id TenantID, name, displayName string) (Tenant, error) {
	if id.IsZero() || name == "" {
		return Tenant{}, fmt.Errorf("id and name required")
	}
	cfg, err := NewTenantConfig("US")
	if err != nil {
		return Tenant{}, err
	}
	now := time.Now().UTC()
	return Tenant{
		ID:          id,
		Name:        name,
		DisplayName: displayName,
		Config:      cfg,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

func (t Tenant) String() string {
	return t.DisplayName
}
