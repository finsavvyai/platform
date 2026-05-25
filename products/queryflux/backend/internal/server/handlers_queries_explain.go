package server

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/application/services/query"
	"github.com/sirupsen/logrus"
)

// explainQuery handles POST /api/v1/connections/:id/explain.
//
// Phase-1 wiring (FIX-E): runs the database-specific EXPLAIN form through
// the SafeQueryRunner against a live adapter. Errors are sanitised via
// SafeErrorMessage (handlers_error_mapper.go).
func (s *Server) explainQuery(c *gin.Context) {
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
		logrus.WithError(err).Error("Failed to bind explain query request")
		s.respondWithValidationError(c, "request", "Invalid request format")
		return
	}

	connectionService := s.container.GetConnectionService()
	connection, err := connectionService.GetByID(c.Request.Context(), connectionID)
	if err != nil {
		s.respondWithNotFound(c, "Connection")
		return
	}
	if connection.UserID != userID {
		s.respondWithForbidden(c, "Access denied to this connection")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	adapter, err := s.resolveAdapter(ctx, connection)
	if err != nil {
		s.respondWithAdapterError(c, connection, "explainQuery: resolveAdapter", err)
		return
	}
	defer func() { _ = adapter.Disconnect(ctx) }()

	explainSQL := prepareExplainQuery(connection.Type, req.SQL)
	result, err := s.ensureRunner().Execute(ctx, adapter, explainSQL, nil, query.QueryOptions{
		UserID:       userID,
		ConnectionID: connectionID,
		MaxRows:      10000,
		Timeout:      30 * time.Second,
	})
	if err != nil {
		s.respondWithAdapterError(c, connection, "explainQuery: runner.Execute", err)
		return
	}

	rows := []map[string]interface{}{}
	if result != nil {
		rows = result.Rows
	}
	s.respondWithSuccess(c, ExplainResponse{
		Query:         req.SQL,
		ExecutionPlan: rows,
		Explanation:   generateExplanation(connection.Type, rows),
	})
}

// prepareExplainQuery prepares an EXPLAIN query based on database type.
func prepareExplainQuery(dbType, sql string) string {
	switch strings.ToLower(dbType) {
	case "postgresql":
		return fmt.Sprintf("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) %s", sql)
	case "mysql", "mariadb":
		return fmt.Sprintf("EXPLAIN FORMAT=JSON %s", sql)
	case "sqlite":
		return fmt.Sprintf("EXPLAIN QUERY PLAN %s", sql)
	case "sqlserver":
		return fmt.Sprintf("SET SHOWPLAN_ALL ON; %s", sql)
	case "oracle":
		return fmt.Sprintf("EXPLAIN PLAN FOR %s", sql)
	default:
		return fmt.Sprintf("EXPLAIN %s", sql)
	}
}

// generateExplanation produces a human-readable summary of an execution plan.
func generateExplanation(dbType string, executionPlan []map[string]interface{}) string {
	if len(executionPlan) == 0 {
		return "No execution plan available"
	}
	switch strings.ToLower(dbType) {
	case "postgresql":
		return "PostgreSQL execution plan - see execution_plan for detailed information"
	case "mysql", "mariadb":
		return "MySQL execution plan - see execution_plan for detailed information"
	case "sqlite":
		return "SQLite query plan - see execution_plan for detailed information"
	default:
		return "Database execution plan - see execution_plan for detailed information"
	}
}
