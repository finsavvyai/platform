package server

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/application/services/query"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
	"github.com/sirupsen/logrus"
)

// queryResultEnvelope is a local alias used by mapQueryResultToResponse so
// the wire-shape mapping does not leak the canonical types package into
// the handler signature surface.
type queryResultEnvelope = types.QueryResult

// executeQuery handles POST /api/v1/connections/:id/query.
//
// Phase-1 wiring (FIX-E): routes the request through
// application/services/query.SafeQueryRunner against a live driver-backed
// types.DatabaseAdapter resolved from the connection factory. The legacy
// mock-data queryService.Execute path is no longer reachable from HTTP.
//
// All error responses use SafeErrorMessage so raw driver text, connection
// strings, and stack traces never leak to the wire (SECURITY_REVIEW HIGH-5).
// userID is threaded into QueryOptions.UserID so audit entries retain
// actor attribution (SECURITY_REVIEW Med-14).
func (s *Server) executeQuery(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		s.respondWithUnauthorized(c, "User not authenticated")
		return
	}
	connectionID := c.Param("id")
	if connectionID == "" {
		s.respondWithValidationError(c, "id", "Connection ID is required")
		return
	}

	var req ExecuteQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logrus.WithError(err).Error("Failed to bind execute query request")
		s.respondWithValidationError(c, "request", "Invalid request format")
		return
	}
	if req.Timeout <= 0 {
		req.Timeout = 30
	}

	connectionService := s.container.GetConnectionService()
	connection, err := connectionService.GetByID(c.Request.Context(), connectionID)
	if err != nil {
		logrus.WithError(err).Error("Failed to get connection")
		s.respondWithNotFound(c, "Connection")
		return
	}
	if connection.UserID != userID {
		s.respondWithForbidden(c, "Access denied to this connection")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(req.Timeout)*time.Second)
	defer cancel()

	adapter, err := s.resolveAdapter(ctx, connection)
	if err != nil {
		s.respondWithAdapterError(c, connection, "executeQuery: resolveAdapter", err)
		return
	}
	defer func() { _ = adapter.Disconnect(ctx) }()

	start := time.Now()
	result, err := s.ensureRunner().Execute(ctx, adapter, req.SQL, nil, query.QueryOptions{
		UserID:       userID,
		ConnectionID: connectionID,
		MaxRows:      10000,
		Timeout:      time.Duration(req.Timeout) * time.Second,
	})
	if err != nil {
		s.respondWithAdapterError(c, connection, "executeQuery: runner.Execute", err)
		return
	}

	if mErr := connectionService.MarkAsUsed(c.Request.Context(), connectionID); mErr != nil {
		logrus.WithError(mErr).Warn("Failed to mark connection as used")
	}

	response := mapQueryResultToResponse(connectionID, req.SQL, result, time.Since(start))
	s.respondWithSuccess(c, response)
}

// mapQueryToResponse converts a persisted Query entity into the
// wire-shape QueryResponse. Used by history and search endpoints which
// read from the queries repository (NOT the live runner path).
func (s *Server) mapQueryToResponse(q *entities.Query) QueryResponse {
	if q == nil {
		return QueryResponse{}
	}
	return QueryResponse{
		ID:           q.ID,
		ConnectionID: q.ConnectionID,
		Name:         q.Name,
		SQL:          q.SQL,
		Results:      q.Results,
		RowCount:     q.RowCount,
		Duration:     q.Duration,
		Status:       q.Status,
		Error:        q.Error,
		ExecutedAt:   q.ExecutedAt.Format("2006-01-02T15:04:05.000Z"),
		CreatedAt:    q.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
	}
}

// mapQueryResultToResponse converts a types.QueryResult from the runner
// into the wire-shape QueryResponse the frontend expects. The runner
// already audited and (on failure) sentinel-wrapped the error path, so
// only the success path needs mapping here.
func mapQueryResultToResponse(
	connectionID, sql string,
	result *queryResultEnvelope,
	dur time.Duration,
) QueryResponse {
	now := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	resp := QueryResponse{
		ConnectionID: connectionID,
		SQL:          sql,
		Status:       entities.QueryStatusCompleted,
		Duration:     dur.Milliseconds(),
		ExecutedAt:   now,
		CreatedAt:    now,
	}
	if result == nil {
		return resp
	}
	resp.Results = result.Rows
	resp.RowCount = int(result.Count)
	if resp.RowCount == 0 && len(result.Rows) > 0 {
		resp.RowCount = len(result.Rows)
	}
	return resp
}
