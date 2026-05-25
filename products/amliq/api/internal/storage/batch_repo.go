package storage

import (
	"context"
	"errors"

	"github.com/aegis-aml/aegis/internal/domain"
)

var ErrBatchNotFound = errors.New("batch job not found")

type BatchRepository interface {
	Create(ctx context.Context, job domain.BatchJob) error
	GetByID(ctx context.Context, id string) (*domain.BatchJob, error)
	Update(ctx context.Context, job domain.BatchJob) error
}

type BatchResultRepository interface {
	BulkInsert(ctx context.Context, results []domain.BatchResult) error
	ListByBatchID(ctx context.Context, batchID string) ([]domain.BatchResult, error)
}
