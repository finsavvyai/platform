package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type CaseQueryRepository interface {
	ListByTenant(ctx context.Context, tenantID domain.TenantID, status string, limit int) ([]domain.ComplianceCase, error)
	CountByStatus(ctx context.Context, tenantID domain.TenantID) (map[string]int, error)
}
