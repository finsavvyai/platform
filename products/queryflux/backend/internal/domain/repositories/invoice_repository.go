package repositories

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
)

// InvoiceRepository defines the interface for invoice persistence
type InvoiceRepository interface {
	// Invoice CRUD operations
	Create(ctx context.Context, invoice *entities.Invoice) error
	GetByID(ctx context.Context, id string) (*entities.Invoice, error)
	GetByInvoiceNumber(ctx context.Context, invoiceNumber string) (*entities.Invoice, error)
	GetByLemonSqueezyID(ctx context.Context, lemonSqueezyID string) (*entities.Invoice, error)
	Update(ctx context.Context, invoice *entities.Invoice) error
	Delete(ctx context.Context, id string) error

	// Invoice queries
	ListByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.Invoice, error)
	ListBySubscription(ctx context.Context, subscriptionID string, limit, offset int) ([]*entities.Invoice, error)
	ListByStatus(ctx context.Context, status string, limit, offset int) ([]*entities.Invoice, error)
	ListOverdue(ctx context.Context, days int) ([]*entities.Invoice, error)

	// Invoice analytics
	GetTotalRevenue(ctx context.Context, startDate, endDate time.Time) (float64, error)
	GetRevenueByPlan(ctx context.Context, startDate, endDate time.Time) (map[string]float64, error)
	CountByStatus(ctx context.Context, status string) (int, error)
	CountByUser(ctx context.Context, userID string) (int, error)
}
