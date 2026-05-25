package port

import (
	"context"

	"github.com/queryflux/backend/internal/domain"
)

type DatabasePort interface {
	ExecuteQuery(ctx context.Context, query string) (*domain.QueryResponse, error)
	GetSchema(ctx context.Context) (*domain.Schema, error)
	ValidateQuery(ctx context.Context, query string) error
	Close() error
	Ping(ctx context.Context) error
}
