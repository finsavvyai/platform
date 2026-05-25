package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type CaseRepository interface {
	Create(ctx context.Context, c domain.ComplianceCase) error
	GetByID(ctx context.Context, id string) (*domain.ComplianceCase, error)
	Update(ctx context.Context, c domain.ComplianceCase) error
	UpdateStatus(ctx context.Context, caseID, status string) error
}

type CaseCommentRepository interface {
	Create(ctx context.Context, c domain.CaseComment) error
	ListByCaseID(ctx context.Context, caseID string) ([]domain.CaseComment, error)
}
