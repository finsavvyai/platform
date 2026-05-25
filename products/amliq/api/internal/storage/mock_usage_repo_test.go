package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type MockUsageRepository struct {
	data map[string]*domain.UsageRecord
}

func NewMockUsageRepository() *MockUsageRepository {
	return &MockUsageRepository{
		data: make(map[string]*domain.UsageRecord),
	}
}

func usageKey(tid domain.TenantID, p domain.Product, period string) string {
	return fmt.Sprintf("%s:%s:%s", tid.Value(), p, period)
}

func (m *MockUsageRepository) GetOrCreate(
	_ context.Context, tenantID domain.TenantID,
	product domain.Product, period string,
) (*domain.UsageRecord, error) {
	key := usageKey(tenantID, product, period)
	if rec, ok := m.data[key]; ok {
		return rec, nil
	}
	rec := &domain.UsageRecord{
		ID:            fmt.Sprintf("usage_%d", time.Now().UnixNano()),
		TenantID:      tenantID.Value(),
		Product:       product,
		Period:        period,
		Metrics:       make(map[domain.UsageMetric]int64),
		LastUpdatedAt: time.Now().UTC(),
	}
	m.data[key] = rec
	return rec, nil
}

func (m *MockUsageRepository) IncrementMetric(
	_ context.Context, tenantID domain.TenantID,
	product domain.Product, period string,
	metric domain.UsageMetric, count int64,
) error {
	key := usageKey(tenantID, product, period)
	rec, ok := m.data[key]
	if !ok {
		rec = &domain.UsageRecord{
			ID:       fmt.Sprintf("usage_%d", time.Now().UnixNano()),
			TenantID: tenantID.Value(),
			Product:  product, Period: period,
			Metrics: make(map[domain.UsageMetric]int64),
		}
		m.data[key] = rec
	}
	rec.Metrics[metric] += count
	return nil
}

func (m *MockUsageRepository) GetHistory(
	_ context.Context, tenantID domain.TenantID,
	product domain.Product, months int,
) ([]domain.UsageRecord, error) {
	var result []domain.UsageRecord
	for _, rec := range m.data {
		if rec.TenantID == tenantID.Value() && rec.Product == product {
			result = append(result, *rec)
		}
	}
	if len(result) > months {
		result = result[:months]
	}
	return result, nil
}
