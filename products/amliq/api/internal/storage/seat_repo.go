package storage

import (
	"context"

	"github.com/aegis-aml/aegis/internal/domain"
)

type SeatRepository interface {
	Create(ctx context.Context, seat domain.Seat) error
	ListByTenant(ctx context.Context, tenantID string) ([]domain.Seat, error)
	UpdateRole(ctx context.Context, seatID string, role domain.Role) error
	Deactivate(ctx context.Context, seatID string) error
	CountByTenant(ctx context.Context, tenantID string) (int, error)
}
