package storage

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

type MockInvoiceRepository struct {
	data    map[string]domain.Invoice
	counter int
}

func NewMockInvoiceRepository() *MockInvoiceRepository {
	return &MockInvoiceRepository{data: make(map[string]domain.Invoice)}
}

func (m *MockInvoiceRepository) Create(_ context.Context, inv domain.Invoice) error {
	if _, exists := m.data[inv.ID]; exists {
		m.counter++
		inv.ID = fmt.Sprintf("%s_%d", inv.ID, m.counter)
	}
	m.data[inv.ID] = inv
	return nil
}

func (m *MockInvoiceRepository) GetByID(_ context.Context, id string) (*domain.Invoice, error) {
	inv, ok := m.data[id]
	if !ok {
		return nil, ErrInvoiceNotFound
	}
	return &inv, nil
}

func (m *MockInvoiceRepository) ListByTenantID(_ context.Context, tenantID domain.TenantID) ([]domain.Invoice, error) {
	var result []domain.Invoice
	for _, inv := range m.data {
		if inv.TenantID.Value() == tenantID.Value() {
			result = append(result, inv)
		}
	}
	return result, nil
}

func (m *MockInvoiceRepository) Update(_ context.Context, inv domain.Invoice) error {
	if _, ok := m.data[inv.ID]; !ok {
		return ErrInvoiceNotFound
	}
	m.data[inv.ID] = inv
	return nil
}

func (m *MockInvoiceRepository) GetByLemonSqueezyID(_ context.Context, lsID string) (*domain.Invoice, error) {
	for _, inv := range m.data {
		if inv.LemonSqueezyInvoiceID == lsID {
			return &inv, nil
		}
	}
	return nil, ErrInvoiceNotFound
}
