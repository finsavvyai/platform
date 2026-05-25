package service

import (
	"context"

	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/port"
	"github.com/queryflux/backend/pkg/logger"
)

type SchemaService struct {
	db          port.DatabasePort
	poolManager *PoolManager
	logger      *logger.Logger
}

func NewSchemaService(db port.DatabasePort, logger *logger.Logger) *SchemaService {
	return &SchemaService{
		db:     db,
		logger: logger,
	}
}

func (s *SchemaService) SetPoolManager(pm *PoolManager) {
	s.poolManager = pm
}

func (s *SchemaService) GetSchema(ctx context.Context, req domain.SchemaRequest, userID string) (*domain.Schema, error) {
	s.logger.Info("Fetching schema", "database_id", req.DatabaseID)

	db := s.db
	if s.poolManager != nil && userID != "" {
		resolved, err := s.poolManager.GetAdapter(ctx, userID, req.DatabaseID)
		if err != nil {
			s.logger.Error("Failed to resolve connection for schema", "error", err)
			return nil, err
		}
		db = resolved
	}

	schema, err := db.GetSchema(ctx)
	if err != nil {
		s.logger.Error("Failed to fetch schema", "error", err)
		return nil, err
	}

	s.logger.Info("Schema fetched successfully", "tables_count", len(schema.Tables))
	return schema, nil
}
