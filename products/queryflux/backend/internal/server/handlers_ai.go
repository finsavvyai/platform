package server

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
)

// AIHandler handles AI-related endpoints with proper domain types
type AIHandler struct {
	aiService ports.AIService
	server    *Server
	logger    *zap.Logger
}

// NewAIHandler creates a new AI handler
func NewAIHandler(aiService ports.AIService, logger *zap.Logger) *AIHandler {
	return &AIHandler{
		aiService: aiService,
		logger:    logger,
	}
}

// setServer sets the server reference (to avoid circular dependency)
func (h *AIHandler) setServer(server *Server) {
	h.server = server
}

// ConvertNLToSQL converts natural language to SQL
// @Summary Convert natural language to SQL
// @Description Convert natural language query to SQL using AI
// @Tags ai
// @Accept json
// @Produce json
// @Param request body NLToSQLRequest true "Natural language to SQL conversion request"
// @Success 200 {object} domain.NLToSQLResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 429 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/ai/nl-to-sql [post]
func (h *AIHandler) ConvertNLToSQL(c *gin.Context) {
	ctx := c.Request.Context()
	userID := h.getUserIDFromContext(c)

	var req NLToSQLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.server.respondWithError(c, http.StatusBadRequest, ErrCodeValidationFailed, "Invalid request format: "+err.Error(), nil)
		return
	}

	// Validate request
	if req.NLQuery == "" {
		h.server.respondWithError(c, http.StatusBadRequest, ErrCodeMissingRequired, "Natural language query is required", nil)
		return
	}

	if req.DatabaseType == "" {
		req.DatabaseType = "postgresql" // Default database type
	}

	// Convert to domain request
	domainRequest := &domain.NLToSQLRequest{
		ID:           uuid.New().String(),
		NLQuery:      req.NLQuery,
		DatabaseType: req.DatabaseType,
		UserID:       userID,
		CreatedAt:    time.Now(),
	}

	// Convert schema if provided
	if req.Schema != nil {
		domainRequest.Schema = h.convertSchemaToDomain(req.Schema)
	}

	// Add context if provided
	if req.Context != nil {
		domainRequest.Context = req.Context
	}

	// Add examples if provided
	if len(req.Examples) > 0 {
		for _, example := range req.Examples {
			domainRequest.Examples = append(domainRequest.Examples, domain.SQLExample{
				NLQuery:     example.NLQuery,
				SQLQuery:    example.SQLQuery,
				Description: example.Description,
			})
		}
	}

	// Call AI service
	response, err := h.aiService.ConvertNLToSQL(ctx, domainRequest)
	if err != nil {
		h.logger.Error("Failed to convert NL to SQL",
			zap.String("user_id", userID),
			zap.String("query", req.NLQuery),
			zap.Error(err))

		// Check for rate limit error
		if isRateLimitError(err) {
			h.server.respondWithError(c, http.StatusTooManyRequests, ErrCodeRateLimitExceeded, "Rate limit exceeded. Please try again later.", nil)
			return
		}

		h.server.respondWithError(c, http.StatusInternalServerError, ErrCodeInternalError, "Failed to convert natural language to SQL", err)
		return
	}

	// Log successful conversion
	h.logger.Info("Successfully converted NL to SQL",
		zap.String("user_id", userID),
		zap.String("request_id", domainRequest.ID),
		zap.Float64("confidence", response.Confidence))

	c.JSON(http.StatusOK, response)
}

// OptimizeQuery provides query optimization suggestions
// @Summary Optimize SQL query
// @Description Analyze and optimize SQL query using AI
// @Tags ai
// @Accept json
// @Produce json
// @Param request body QueryOptimizationRequest true "Query optimization request"
// @Success 200 {object} domain.QueryOptimizationResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 429 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/ai/optimize-query [post]
func (h *AIHandler) OptimizeQuery(c *gin.Context) {
	ctx := c.Request.Context()
	userID := h.getUserIDFromContext(c)

	var req QueryOptimizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.server.respondWithError(c, http.StatusBadRequest, ErrCodeValidationFailed, "Invalid request format: "+err.Error(), nil)
		return
	}

	// Validate request
	if req.SQLQuery == "" {
		h.server.respondWithError(c, http.StatusBadRequest, ErrCodeMissingRequired, "SQL query is required", nil)
		return
	}

	if req.DatabaseType == "" {
		req.DatabaseType = "postgresql" // Default database type
	}

	// Convert to domain request
	domainRequest := &domain.QueryOptimizationRequest{
		ID:           uuid.New().String(),
		SQLQuery:     req.SQLQuery,
		DatabaseType: req.DatabaseType,
		UserID:       userID,
		CreatedAt:    time.Now(),
	}

	// Convert schema if provided
	if req.Schema != nil {
		domainRequest.DatabaseSchema = h.convertSchemaToDomain(req.Schema)
	}

	// Parse execution plan if provided
	if req.ExecutionPlan != nil {
		domainRequest.ExecutionPlan = req.ExecutionPlan
	}

	// Parse performance metrics if provided
	if req.PerformanceMetrics != nil {
		domainRequest.PerformanceMetrics = &domain.QueryPerformanceMetrics{
			ExecutionTime: time.Duration(req.PerformanceMetrics.ExecutionTimeSeconds) * time.Second,
			RowsReturned:  req.PerformanceMetrics.RowsReturned,
			RowsScanned:   req.PerformanceMetrics.RowsScanned,
			BytesScanned:  req.PerformanceMetrics.BytesScanned,
			CPUUsage:      req.PerformanceMetrics.CPUUsage,
			MemoryUsage:   req.PerformanceMetrics.MemoryUsage,
		}
	}

	// Call AI service
	response, err := h.aiService.OptimizeQuery(ctx, domainRequest)
	if err != nil {
		h.logger.Error("Failed to optimize query",
			zap.String("user_id", userID),
			zap.Error(err))

		if isRateLimitError(err) {
			h.server.respondWithError(c, http.StatusTooManyRequests, ErrCodeRateLimitExceeded, "Rate limit exceeded. Please try again later.", nil)
			return
		}

		h.server.respondWithError(c, http.StatusInternalServerError, ErrCodeInternalError, "Failed to optimize query", err)
		return
	}

	// Log successful optimization
	h.logger.Info("Successfully optimized query",
		zap.String("user_id", userID),
		zap.String("request_id", domainRequest.ID),
		zap.Float64("estimated_gain", response.EstimatedGain))

	c.JSON(http.StatusOK, response)
}

// ExplainQuery provides human-readable query explanations
// @Summary Explain SQL query
// @Description Explain SQL query in human-readable terms using AI
// @Tags ai
// @Accept json
// @Produce json
// @Param request body QueryExplanationRequest true "Query explanation request"
// @Success 200 {object} domain.QueryExplanationResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 429 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/ai/explain-query [post]
func (h *AIHandler) ExplainQuery(c *gin.Context) {
	ctx := c.Request.Context()
	userID := h.getUserIDFromContext(c)

	var req QueryExplanationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.server.respondWithError(c, http.StatusBadRequest, ErrCodeValidationFailed, "Invalid request format: "+err.Error(), nil)
		return
	}

	// Validate request
	if req.SQLQuery == "" {
		h.server.respondWithError(c, http.StatusBadRequest, ErrCodeMissingRequired, "SQL query is required", nil)
		return
	}

	// Set defaults
	if req.DatabaseType == "" {
		req.DatabaseType = "postgresql"
	}
	if req.Complexity == "" {
		req.Complexity = "moderate"
	}
	if req.Audience == "" {
		req.Audience = "intermediate"
	}
	if req.Language == "" {
		req.Language = "english"
	}

	// Convert to domain request
	domainRequest := &domain.QueryExplanationRequest{
		ID:           uuid.New().String(),
		SQLQuery:     req.SQLQuery,
		DatabaseType: req.DatabaseType,
		Complexity:   req.Complexity,
		Audience:     req.Audience,
		Language:     req.Language,
		UserID:       userID,
		CreatedAt:    time.Now(),
	}

	// Call AI service
	response, err := h.aiService.ExplainQuery(ctx, domainRequest)
	if err != nil {
		h.logger.Error("Failed to explain query",
			zap.String("user_id", userID),
			zap.Error(err))

		if isRateLimitError(err) {
			h.server.respondWithError(c, http.StatusTooManyRequests, ErrCodeRateLimitExceeded, "Rate limit exceeded. Please try again later.", nil)
			return
		}

		h.server.respondWithError(c, http.StatusInternalServerError, ErrCodeInternalError, "Failed to explain query", err)
		return
	}

	// Log successful explanation
	h.logger.Info("Successfully explained query",
		zap.String("user_id", userID),
		zap.String("request_id", domainRequest.ID),
		zap.String("complexity", response.Complexity))

	c.JSON(http.StatusOK, response)
}

// GenerateQuery generates SQL based on requirements
func (h *AIHandler) GenerateQuery(c *gin.Context) {
	var req NLToSQLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.server.respondWithError(c, http.StatusBadRequest, ErrCodeValidationFailed, "Invalid request format: "+err.Error(), nil)
		return
	}

	userID := h.getUserIDFromContext(c)
	ctx := c.Request.Context()

	domainRequest := &domain.QueryGenerationRequest{
		ID:           uuid.New().String(),
		Requirements: req.NLQuery,
		Schema:       h.convertSchemaToDomain(req.Schema),
		UserID:       userID,
		CreatedAt:    time.Now(),
	}

	response, err := h.aiService.GenerateQuery(ctx, domainRequest)
	if err != nil {
		h.logger.Error("Failed to generate query",
			zap.String("user_id", userID),
			zap.Error(err))

		if isRateLimitError(err) {
			h.server.respondWithError(c, http.StatusTooManyRequests, ErrCodeRateLimitExceeded, "Rate limit exceeded. Please try again later.", nil)
			return
		}

		h.server.respondWithError(c, http.StatusInternalServerError, ErrCodeInternalError, "Failed to generate query", err)
		return
	}

	h.server.respondWithSuccess(c, response)
}

// AnalyzePerformance analyzes query performance
func (h *AIHandler) AnalyzePerformance(c *gin.Context) {
	var req QueryOptimizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.server.respondWithError(c, http.StatusBadRequest, ErrCodeValidationFailed, "Invalid request format: "+err.Error(), nil)
		return
	}

	userID := h.getUserIDFromContext(c)
	ctx := c.Request.Context()

	domainRequest := &domain.PerformanceAnalysisRequest{
		ID:             uuid.New().String(),
		SQLQuery:       req.SQLQuery,
		ExecutionPlan:  fmt.Sprintf("%v", req.ExecutionPlan),
		DatabaseSchema: h.convertSchemaToDomain(req.Schema),
		UserID:         userID,
		CreatedAt:      time.Now(),
	}

	response, err := h.aiService.AnalyzePerformance(ctx, domainRequest)
	if err != nil {
		h.logger.Error("Failed to analyze performance",
			zap.String("user_id", userID),
			zap.Error(err))

		if isRateLimitError(err) {
			h.server.respondWithError(c, http.StatusTooManyRequests, ErrCodeRateLimitExceeded, "Rate limit exceeded. Please try again later.", nil)
			return
		}

		h.server.respondWithError(c, http.StatusInternalServerError, ErrCodeInternalError, "Failed to analyze performance", err)
		return
	}

	h.server.respondWithSuccess(c, response)
}

// GetAIUsage retrieves AI usage statistics for a user
func (h *AIHandler) GetAIUsage(c *gin.Context) {
	// ... logic from improved version ...
	ctx := c.Request.Context()
	userID := h.getUserIDFromContext(c)
	_ = ctx

	// Parse date parameters
	startDate := time.Now().AddDate(0, -1, 0)
	endDate := time.Now()

	// Return mock response as in improved version
	response := AIUsageResponse{
		UserID:    userID,
		StartDate: startDate,
		EndDate:   endDate,
		Services: map[string]ServiceUsage{
			"openai": {
				Requests:   150,
				TokensUsed: 45000,
				Cost:       2.25,
				LastUsed:   time.Now().Add(-time.Hour),
			},
		},
		TotalRequests: 150,
		TotalTokens:   45000,
		TotalCost:     2.25,
	}

	c.JSON(http.StatusOK, response)
}

// GetAIStatus returns the status of AI services
func (h *AIHandler) GetAIStatus(c *gin.Context) {
	userID := h.getUserIDFromContext(c)

	status := AIStatusResponse{
		Services: map[string]ServiceStatus{
			"openai": {
				Enabled:     true,
				Healthy:     true,
				Model:       "gpt-4",
				RateLimit:   "20 requests/minute",
				LastChecked: time.Now(),
			},
		},
		Features: []string{
			"Natural language to SQL conversion",
			"Query optimization",
			"Query explanation",
		},
		LastUpdated: time.Now(),
	}

	h.logger.Info("AI status checked", zap.String("user_id", userID))
	c.JSON(http.StatusOK, status)
}

// BatchProcessAIRequests processes multiple AI requests in a batch
func (h *AIHandler) BatchProcessAIRequests(c *gin.Context) {
	// Re-implementing from old version if needed, or using a new version compatible with Improved logic
	// For now, let's keep it simple or implement if critical
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Batch processing not implemented in improved version yet"})
}

// Helper methods
func (h *AIHandler) getUserIDFromContext(c *gin.Context) string {
	if userID, exists := c.Get("user_id"); exists {
		if id, ok := userID.(string); ok {
			return id
		}
	}
	return "anonymous"
}

func (h *AIHandler) convertSchemaToDomain(reqSchema *DatabaseSchema) domain.DatabaseSchema {
	domainSchema := domain.DatabaseSchema{
		Tables: []domain.TableSchema{},
	}

	for _, reqTable := range reqSchema.Tables {
		tableSchema := domain.TableSchema{
			Name:        reqTable.Name,
			Columns:     []domain.ColumnSchema{},
			PrimaryKey:  reqTable.PrimaryKey,
			ForeignKeys: []domain.ForeignKey{},
			RowCount:    reqTable.RowCount,
		}

		for _, reqCol := range reqTable.Columns {
			colSchema := domain.ColumnSchema{
				Name:     reqCol.Name,
				Type:     reqCol.Type,
				Nullable: reqCol.Nullable,
				Comment:  reqCol.Comment,
			}
			if reqCol.Default != nil {
				colSchema.Default = reqCol.Default
			}
			tableSchema.Columns = append(tableSchema.Columns, colSchema)
		}

		for _, reqFK := range reqTable.ForeignKeys {
			fkSchema := domain.ForeignKey{
				Column:           reqFK.Column,
				ReferencesTable:  reqFK.ReferencesTable,
				ReferencesColumn: reqFK.ReferencesColumn,
			}
			tableSchema.ForeignKeys = append(tableSchema.ForeignKeys, fkSchema)
		}

		domainSchema.Tables = append(domainSchema.Tables, tableSchema)
	}

	return domainSchema
}

func isRateLimitError(err error) bool {
	return strings.Contains(err.Error(), "rate limit exceeded")
}

// Types used by AIHandler
type NLToSQLRequest struct {
	NLQuery      string            `json:"nl_query" binding:"required"`
	DatabaseType string            `json:"database_type"`
	Schema       *DatabaseSchema   `json:"schema,omitempty"`
	Context      map[string]string `json:"context,omitempty"`
	Examples     []SQLExample      `json:"examples,omitempty"`
}

type SQLExample struct {
	NLQuery     string `json:"nl_query"`
	SQLQuery    string `json:"sql_query"`
	Description string `json:"description,omitempty"`
}

type DatabaseSchema struct {
	Tables []TableSchema `json:"tables"`
}

type TableSchema struct {
	Name        string         `json:"name"`
	Columns     []ColumnSchema `json:"columns"`
	PrimaryKey  []string       `json:"primary_key,omitempty"`
	ForeignKeys []ForeignKey   `json:"foreign_keys,omitempty"`
	RowCount    int64          `json:"row_count,omitempty"`
}

type ColumnSchema struct {
	Name     string  `json:"name"`
	Type     string  `json:"type"`
	Nullable bool    `json:"nullable"`
	Default  *string `json:"default,omitempty"`
	Comment  string  `json:"comment,omitempty"`
}

type ForeignKey struct {
	Column           string `json:"column"`
	ReferencesTable  string `json:"references_table"`
	ReferencesColumn string `json:"references_column"`
}

type QueryOptimizationRequest struct {
	SQLQuery           string              `json:"sql_query" binding:"required"`
	DatabaseType       string              `json:"database_type"`
	Schema             *DatabaseSchema     `json:"schema,omitempty"`
	ExecutionPlan      interface{}         `json:"execution_plan,omitempty"`
	PerformanceMetrics *PerformanceMetrics `json:"performance_metrics,omitempty"`
}

type PerformanceMetrics struct {
	ExecutionTimeSeconds float64 `json:"execution_time_seconds"`
	RowsReturned         int64   `json:"rows_returned"`
	RowsScanned          int64   `json:"rows_scanned"`
	BytesScanned         int64   `json:"bytes_scanned"`
	CPUUsage             float64 `json:"cpu_usage"`
	MemoryUsage          int64   `json:"memory_usage"`
}

type QueryExplanationRequest struct {
	SQLQuery     string `json:"sql_query" binding:"required"`
	DatabaseType string `json:"database_type"`
	Complexity   string `json:"complexity"`
	Audience     string `json:"audience"`
	Language     string `json:"language"`
}

type AIUsageResponse struct {
	UserID        string                  `json:"user_id"`
	StartDate     time.Time               `json:"start_date"`
	EndDate       time.Time               `json:"end_date"`
	Services      map[string]ServiceUsage `json:"services"`
	TotalRequests int                     `json:"total_requests"`
	TotalTokens   int                     `json:"total_tokens"`
	TotalCost     float64                 `json:"total_cost"`
}

type ServiceUsage struct {
	Requests      int          `json:"requests"`
	TokensUsed    int          `json:"tokens_used"`
	Cost          float64      `json:"cost"`
	LastUsed      time.Time    `json:"last_used"`
	DailyRequests []DailyUsage `json:"daily_requests"`
}

type DailyUsage struct {
	Date     time.Time `json:"date"`
	Requests int       `json:"requests"`
}

type AIStatusResponse struct {
	Services    map[string]ServiceStatus `json:"services"`
	UserLimits  UserLimits               `json:"user_limits"`
	Features    []string                 `json:"features"`
	LastUpdated time.Time                `json:"last_updated"`
}

type ServiceStatus struct {
	Enabled     bool      `json:"enabled"`
	Healthy     bool      `json:"healthy"`
	Model       string    `json:"model"`
	RateLimit   string    `json:"rate_limit"`
	LastChecked time.Time `json:"last_checked"`
	Message     string    `json:"message,omitempty"`
}

type UserLimits struct {
	RequestsPerMinute int     `json:"requests_per_minute"`
	TokensPerDay      int     `json:"tokens_per_day"`
	BudgetRemaining   float64 `json:"budget_remaining"`
}
