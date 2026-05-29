package service

import (
	"context"

	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/port"
	"github.com/queryflux/backend/pkg/logger"
)

type QueryService struct {
	db          port.DatabasePort
	poolManager *PoolManager
	metrics     *QueryMetricsService
	logger      *logger.Logger
}

func NewQueryService(db port.DatabasePort, log *logger.Logger) *QueryService {
	return &QueryService{
		db:      db,
		metrics: NewQueryMetricsService(0),
		logger:  log,
	}
}

func (s *QueryService) SetPoolManager(pm *PoolManager) {
	s.poolManager = pm
}

func (s *QueryService) Metrics() *QueryMetricsService {
	return s.metrics
}

func (s *QueryService) Execute(ctx context.Context, req domain.QueryRequest, userID ...string) (*domain.QueryResponse, error) {
	s.logger.Info("Executing query", "database_id", req.DatabaseID, "dry_run", req.DryRun)

	db := s.db
	if s.poolManager != nil && len(userID) > 0 && userID[0] != "" {
		resolved, err := s.poolManager.GetAdapter(ctx, userID[0], req.DatabaseID)
		if err != nil {
			return nil, err
		}
		db = resolved
	}

	if req.DryRun {
		if err := db.ValidateQuery(ctx, req.SQL); err != nil {
			return &domain.QueryResponse{
				SQL:   req.SQL,
				Error: err.Error(),
			}, err
		}
		return &domain.QueryResponse{SQL: req.SQL}, nil
	}

	result, err := db.ExecuteQuery(ctx, req.SQL)
	if err != nil {
		s.logger.Error("Query execution failed", "error", err)
		s.metrics.RecordQuery(0, true)
		return result, err
	}

	s.logger.Info("Query executed successfully", "execution_ms", result.ExecutionMs)
	s.metrics.RecordQuery(result.ExecutionMs, false)
	return result, nil
}
