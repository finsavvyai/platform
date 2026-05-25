package storage

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type ScreeningRepository interface {
	Create(response domain.ScreenResponse) error
	GetByID(id string) (*domain.ScreenResponse, error)
	ListByTenant(tenantID domain.TenantID) ([]domain.ScreenResponse, error)
}

type InMemoryScreeningRepo struct {
	screenings map[string]domain.ScreenResponse
}

func NewInMemoryScreeningRepo() *InMemoryScreeningRepo {
	return &InMemoryScreeningRepo{
		screenings: make(map[string]domain.ScreenResponse),
	}
}

func (r *InMemoryScreeningRepo) Create(response domain.ScreenResponse) error {
	r.screenings[response.ID] = response
	return nil
}

func (r *InMemoryScreeningRepo) GetByID(id string) (*domain.ScreenResponse, error) {
	resp, exists := r.screenings[id]
	if !exists {
		return nil, nil
	}
	return &resp, nil
}

func (r *InMemoryScreeningRepo) ListByTenant(tenantID domain.TenantID) ([]domain.ScreenResponse, error) {
	var results []domain.ScreenResponse
	for _, resp := range r.screenings {
		if resp.Request.TenantID == tenantID {
			results = append(results, resp)
		}
	}
	return results, nil
}
