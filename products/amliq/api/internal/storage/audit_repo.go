package storage

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type AuditRepository interface {
	Create(entry domain.AuditEntry) error
	GetByID(id string) (*domain.AuditEntry, error)
	ListByTenant(tenantID domain.TenantID) ([]domain.AuditEntry, error)
	ListByResource(resourceID string) ([]domain.AuditEntry, error)
}

type InMemoryAuditRepo struct {
	entries map[string]domain.AuditEntry
}

func NewInMemoryAuditRepo() *InMemoryAuditRepo {
	return &InMemoryAuditRepo{
		entries: make(map[string]domain.AuditEntry),
	}
}

func (r *InMemoryAuditRepo) Create(entry domain.AuditEntry) error {
	r.entries[entry.ID] = entry
	return nil
}

func (r *InMemoryAuditRepo) GetByID(id string) (*domain.AuditEntry, error) {
	entry, exists := r.entries[id]
	if !exists {
		return nil, nil
	}
	return &entry, nil
}

func (r *InMemoryAuditRepo) ListByTenant(tenantID domain.TenantID) ([]domain.AuditEntry, error) {
	var results []domain.AuditEntry
	for _, entry := range r.entries {
		if entry.TenantID == tenantID {
			results = append(results, entry)
		}
	}
	return results, nil
}

func (r *InMemoryAuditRepo) ListByResource(resourceID string) ([]domain.AuditEntry, error) {
	var results []domain.AuditEntry
	for _, entry := range r.entries {
		if entry.ResourceID == resourceID {
			results = append(results, entry)
		}
	}
	return results, nil
}
