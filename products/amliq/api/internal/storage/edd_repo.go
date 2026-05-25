package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type EDDRepository interface {
	Create(ctx context.Context, report domain.EDDReport) error
	GetByID(ctx context.Context, id string) (*domain.EDDReport, error)
	Update(ctx context.Context, report domain.EDDReport) error
}
