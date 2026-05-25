package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

// MonitorAlertRepository persists monitoring alerts.
type MonitorAlertRepository interface {
	Create(ctx context.Context, alert domain.MonitorAlert) error
	ListByTenant(ctx context.Context, tid domain.TenantID) ([]domain.MonitorAlert, error)
	GetByID(ctx context.Context, id string) (*domain.MonitorAlert, error)
}
