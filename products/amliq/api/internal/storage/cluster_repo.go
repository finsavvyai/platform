package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type EntityClusterRepository interface {
	Create(ctx context.Context, cluster domain.EntityCluster) error
	ListByTenant(ctx context.Context, tenantID domain.TenantID) ([]domain.EntityCluster, error)
	UpdateStatus(ctx context.Context, clusterID, status string) error
}
