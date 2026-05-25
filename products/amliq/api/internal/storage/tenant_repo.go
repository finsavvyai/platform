package storage

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type TenantRepository interface {
	Create(tenant domain.Tenant) error
	GetByID(id domain.TenantID) (*domain.Tenant, error)
	GetByName(name string) (*domain.Tenant, error)
	Update(tenant domain.Tenant) error
	List() ([]domain.Tenant, error)
}

type InMemoryTenantRepo struct {
	tenants map[string]domain.Tenant
}

func NewInMemoryTenantRepo() *InMemoryTenantRepo {
	return &InMemoryTenantRepo{
		tenants: make(map[string]domain.Tenant),
	}
}

func (r *InMemoryTenantRepo) Create(tenant domain.Tenant) error {
	r.tenants[tenant.ID.String()] = tenant
	return nil
}

func (r *InMemoryTenantRepo) GetByName(name string) (*domain.Tenant, error) {
	for _, t := range r.tenants {
		if t.Name == name {
			return &t, nil
		}
	}
	return nil, nil
}

func (r *InMemoryTenantRepo) GetByID(id domain.TenantID) (*domain.Tenant, error) {
	tenant, exists := r.tenants[id.String()]
	if !exists {
		return nil, nil
	}
	return &tenant, nil
}

func (r *InMemoryTenantRepo) Update(tenant domain.Tenant) error {
	r.tenants[tenant.ID.String()] = tenant
	return nil
}

func (r *InMemoryTenantRepo) List() ([]domain.Tenant, error) {
	var results []domain.Tenant
	for _, tenant := range r.tenants {
		results = append(results, tenant)
	}
	return results, nil
}
