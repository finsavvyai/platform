package storage

import (
	"context"
	"errors"

	"github.com/aegis-aml/aegis/internal/domain"
)

var ErrUsageRecordNotFound = errors.New("usage record not found")

type UsageRepository interface {
	GetOrCreate(ctx context.Context, tenantID domain.TenantID, product domain.Product, period string) (*domain.UsageRecord, error)
	IncrementMetric(ctx context.Context, tenantID domain.TenantID, product domain.Product, period string, metric domain.UsageMetric, count int64) error
	GetHistory(ctx context.Context, tenantID domain.TenantID, product domain.Product, months int) ([]domain.UsageRecord, error)
}
