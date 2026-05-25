package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type UBORepository interface {
	Create(ctx context.Context, owner domain.BeneficialOwner) error
	ListByOrg(ctx context.Context, orgID string) ([]domain.BeneficialOwner, error)
	Update(ctx context.Context, owner domain.BeneficialOwner) error
	GetByID(ctx context.Context, id string) (domain.BeneficialOwner, error)
	Delete(ctx context.Context, id string) error
}
