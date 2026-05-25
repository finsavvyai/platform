package storage

import (
	"context"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

type MockSubscriptionRepository struct {
	data    map[string]domain.Subscription
	counter int
}

func NewMockSubscriptionRepository() *MockSubscriptionRepository {
	return &MockSubscriptionRepository{
		data: make(map[string]domain.Subscription),
	}
}

func (m *MockSubscriptionRepository) Create(_ context.Context, sub domain.Subscription) error {
	if _, exists := m.data[sub.ID]; exists {
		m.counter++
		sub.ID = fmt.Sprintf("%s_%d", sub.ID, m.counter)
	}
	m.data[sub.ID] = sub
	return nil
}

func (m *MockSubscriptionRepository) GetByTenantID(_ context.Context, tenantID domain.TenantID) (*domain.Subscription, error) {
	for _, sub := range m.data {
		if sub.TenantID == tenantID.Value() {
			return &sub, nil
		}
	}
	return nil, ErrSubscriptionNotFound
}

func (m *MockSubscriptionRepository) GetByLemonSqueezyID(_ context.Context, lsID string) (*domain.Subscription, error) {
	for _, sub := range m.data {
		if sub.LemonSqueezyID == lsID {
			return &sub, nil
		}
	}
	return nil, ErrSubscriptionNotFound
}

func (m *MockSubscriptionRepository) Update(_ context.Context, sub domain.Subscription) error {
	if _, ok := m.data[sub.ID]; !ok {
		return ErrSubscriptionNotFound
	}
	m.data[sub.ID] = sub
	return nil
}

func (m *MockSubscriptionRepository) Delete(_ context.Context, id string) error {
	if _, ok := m.data[id]; !ok {
		return ErrSubscriptionNotFound
	}
	delete(m.data, id)
	return nil
}

func (m *MockSubscriptionRepository) ListByTenantID(_ context.Context, tenantID domain.TenantID) ([]domain.Subscription, error) {
	var result []domain.Subscription
	for _, sub := range m.data {
		if sub.TenantID == tenantID.Value() {
			result = append(result, sub)
		}
	}
	return result, nil
}
