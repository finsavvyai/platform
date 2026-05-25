package database

import (
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters"

	"github.com/sirupsen/logrus"
)

// Re-export types from adapters package for backward compatibility
type QueryResult = adapters.QueryResult
type SchemaInfo = adapters.SchemaInfo
type TableInfo = adapters.TableInfo
type ColumnInfo = adapters.ColumnInfo
type IndexInfo = adapters.IndexInfo
type DatabaseAdapter = adapters.DatabaseAdapter
type AdapterError = adapters.AdapterError

// AdapterFactory creates database adapters based on connection type
type AdapterFactory struct {
	logger *logrus.Logger
}

// NewAdapterFactory creates a new adapter factory
func NewAdapterFactory(logger *logrus.Logger) *AdapterFactory {
	return &AdapterFactory{
		logger: logger,
	}
}

// CreateAdapter creates a database adapter for the given connection type
func (f *AdapterFactory) CreateAdapter(conn *entities.Connection) (DatabaseAdapter, error) {
	// Use the new factory from adapters package
	factory := adapters.NewFactory(f.logger)
	return factory.CreateAdapter(conn)
}