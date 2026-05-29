package service

import (
	"context"

	"github.com/queryflux/backend/internal/domain"
)

// testMockDB is a shared mock implementing port.DatabasePort for service tests.
type testMockDB struct {
	executeQueryFunc  func(ctx context.Context, query string) (*domain.QueryResponse, error)
	getSchemaFunc     func(ctx context.Context) (*domain.Schema, error)
	validateQueryFunc func(ctx context.Context, query string) error
}

func (m *testMockDB) ExecuteQuery(ctx context.Context, query string) (*domain.QueryResponse, error) {
	if m.executeQueryFunc != nil {
		return m.executeQueryFunc(ctx, query)
	}
	return nil, nil
}

func (m *testMockDB) GetSchema(ctx context.Context) (*domain.Schema, error) {
	if m.getSchemaFunc != nil {
		return m.getSchemaFunc(ctx)
	}
	return nil, nil
}

func (m *testMockDB) ValidateQuery(ctx context.Context, query string) error {
	if m.validateQueryFunc != nil {
		return m.validateQueryFunc(ctx, query)
	}
	return nil
}

func (m *testMockDB) Close() error                   { return nil }
func (m *testMockDB) Ping(ctx context.Context) error { return nil }
