package adapter

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/service"
)

// DatabaseHandler provides frontend-compatible /api/v1/database/* routes.
type DatabaseHandler struct {
	queryService  *service.QueryService
	schemaService *service.SchemaService
}

func NewDatabaseHandler(qs *service.QueryService, ss *service.SchemaService) *DatabaseHandler {
	return &DatabaseHandler{queryService: qs, schemaService: ss}
}

func (h *DatabaseHandler) RegisterRoutes(group *gin.RouterGroup) {
	db := group.Group("/database")
	{
		db.POST("/query", h.executeQuery)
		db.POST("/schema", h.getSchema)
		db.POST("/connect", h.testConnect)
		db.POST("/explain", h.explainQuery)
	}
}

// Frontend sends {connectionId, sql}; backend expects {database_id, sql}.
func (h *DatabaseHandler) executeQuery(c *gin.Context) {
	var req struct {
		ConnectionID string `json:"connectionId" binding:"required"`
		SQL          string `json:"sql" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	userID, _ := GetUserID(c)
	qr := domain.QueryRequest{DatabaseID: req.ConnectionID, SQL: req.SQL}
	result, err := h.queryService.Execute(c.Request.Context(), qr, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(toFrontendQueryResult(result)))
}

// Frontend sends {connectionId}; backend expects {database_id}.
func (h *DatabaseHandler) getSchema(c *gin.Context) {
	var req struct {
		ConnectionID string `json:"connectionId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	userID, _ := GetUserID(c)
	sr := domain.SchemaRequest{DatabaseID: req.ConnectionID}
	schema, err := h.schemaService.GetSchema(c.Request.Context(), sr, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(toFrontendSchema(schema)))
}

// Frontend sends connection config to test without saving.
func (h *DatabaseHandler) testConnect(c *gin.Context) {
	var req struct {
		Host     string `json:"host" binding:"required"`
		Port     int    `json:"port"`
		Database string `json:"database"`
		Username string `json:"username"`
		Password string `json:"password"`
		SSL      bool   `json:"ssl"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	sslMode := "disable"
	if req.SSL {
		sslMode = "require"
	}
	if req.Port == 0 {
		req.Port = 5432
	}

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		req.Username, req.Password, req.Host, req.Port, req.Database, sslMode,
	)

	start := time.Now()
	adapter, err := NewPostgresAdapter(dsn)
	latency := time.Since(start).Seconds() * 1000

	if err != nil {
		c.JSON(http.StatusOK, domain.SuccessResponse(domain.TestConnectionResponse{
			Success: false, Message: err.Error(),
		}))
		return
	}
	defer adapter.Close()

	c.JSON(http.StatusOK, domain.SuccessResponse(domain.TestConnectionResponse{
		Success: true, Message: "connection successful", LatencyMs: latency,
	}))
}

// explainQuery runs EXPLAIN ANALYZE on the provided SQL and returns the plan.
func (h *DatabaseHandler) explainQuery(c *gin.Context) {
	var req struct {
		ConnectionID string `json:"connectionId" binding:"required"`
		SQL          string `json:"sql" binding:"required"`
		Analyze      bool   `json:"analyze"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	userID, _ := GetUserID(c)

	explainSQL := "EXPLAIN "
	if req.Analyze {
		explainSQL = "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) "
	}
	explainSQL += req.SQL

	qr := domain.QueryRequest{DatabaseID: req.ConnectionID, SQL: explainSQL}
	result, err := h.queryService.Execute(c.Request.Context(), qr, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(map[string]interface{}{
		"plan":        result.Rows,
		"executionMs": result.ExecutionMs,
		"sql":         req.SQL,
	}))
}

// toFrontendSchema wraps flat schema into frontend-expected nested format.
func toFrontendSchema(s *domain.Schema) map[string]interface{} {
	return map[string]interface{}{
		"databases": []map[string]interface{}{
			{
				"name": "default",
				"schemas": []map[string]interface{}{
					{"name": "public", "tables": s.Tables},
				},
			},
		},
	}
}

// toFrontendQueryResult converts domain.QueryResponse to frontend format.
func toFrontendQueryResult(r *domain.QueryResponse) map[string]interface{} {
	columns := []string{}
	if len(r.Rows) > 0 {
		for k := range r.Rows[0] {
			columns = append(columns, k)
		}
	}
	return map[string]interface{}{
		"columns":       columns,
		"rows":          r.Rows,
		"rowCount":      len(r.Rows),
		"executionTime": r.ExecutionMs,
	}
}
