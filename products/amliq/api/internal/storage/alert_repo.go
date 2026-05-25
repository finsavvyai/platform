package storage

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type AlertRepository interface {
	Create(alert domain.Alert) error
	GetByID(id string) (*domain.Alert, error)
	ListByTenant(tenantID domain.TenantID) ([]domain.Alert, error)
	Update(alert domain.Alert) error
}

type InMemoryAlertRepo struct {
	alerts map[string]domain.Alert
}

func NewInMemoryAlertRepo() *InMemoryAlertRepo {
	return &InMemoryAlertRepo{
		alerts: make(map[string]domain.Alert),
	}
}

func (r *InMemoryAlertRepo) Create(alert domain.Alert) error {
	r.alerts[alert.ID] = alert
	return nil
}

func (r *InMemoryAlertRepo) GetByID(id string) (*domain.Alert, error) {
	alert, exists := r.alerts[id]
	if !exists {
		return nil, nil
	}
	return &alert, nil
}

func (r *InMemoryAlertRepo) ListByTenant(tenantID domain.TenantID) ([]domain.Alert, error) {
	var results []domain.Alert
	for _, alert := range r.alerts {
		if alert.TenantID == tenantID {
			results = append(results, alert)
		}
	}
	return results, nil
}

func (r *InMemoryAlertRepo) Update(alert domain.Alert) error {
	r.alerts[alert.ID] = alert
	return nil
}
