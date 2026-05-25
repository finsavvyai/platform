package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type mockBillingEventRepository struct {
	events []domain.BillingEvent
}

func newMockBillingEventRepo() *mockBillingEventRepository {
	return &mockBillingEventRepository{}
}

func (m *mockBillingEventRepository) Append(_ context.Context, evt domain.BillingEvent) error {
	m.events = append(m.events, evt)
	return nil
}

func (m *mockBillingEventRepository) GetByID(_ context.Context, id string) (*domain.BillingEvent, error) {
	for i := range m.events {
		if m.events[i].ID == id {
			return &m.events[i], nil
		}
	}
	return nil, ErrBillingEventNotFound
}

func (m *mockBillingEventRepository) ListByTenantID(_ context.Context, tenantID domain.TenantID, limit int) ([]domain.BillingEvent, error) {
	var result []domain.BillingEvent
	for _, e := range m.events {
		if e.TenantID.Value() == tenantID.Value() {
			result = append(result, e)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockBillingEventRepository) ListByType(_ context.Context, t domain.BillingEventType, limit int) ([]domain.BillingEvent, error) {
	var result []domain.BillingEvent
	for _, e := range m.events {
		if e.Type == t {
			result = append(result, e)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}
