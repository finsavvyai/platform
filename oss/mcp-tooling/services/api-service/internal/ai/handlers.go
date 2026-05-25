package ai

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/logging"
	"go.uber.org/zap"
)

// AIHandler handles AI-powered connector generation requests
type AIHandler struct {
	cfg              *config.Config
	openhandsService *OpenHandsService
}

// NewAIHandler creates a new AI handler instance
func NewAIHandler(cfg *config.Config) *AIHandler {
	return &AIHandler{
		cfg:              cfg,
		openhandsService: NewOpenHandsService(cfg),
	}
}

// Natural Language Connector Generation Request
type NLGenerationRequest struct {
	Description string `json:"description" binding:"required"`
	UserID      string `json:"userId"`
}

// Natural Language Connector Generation Response
type NLGenerationResponse struct {
	JobID       string `json:"jobId"`
	Status      string `json:"status"`
	Message     string `json:"message"`
	EstimatedMS int    `json:"estimatedMs"`
}

// API Analysis Request
type APIAnalysisRequest struct {
	SpecType string      `json:"specType" binding:"required,oneof=openapi graphql postman"`
	Spec     interface{} `json:"spec" binding:"required"`
}

// API Analysis Response
type APIAnalysisResponse struct {
	Purpose          string   `json:"purpose"`
	Domain           string   `json:"domain"`
	AuthMethods      []string `json:"authMethods"`
	RateLimits       string   `json:"rateLimits,omitempty"`
	DataModels       []string `json:"dataModels"`
	RecommendedTools []string `json:"recommendedTools"`
	ErrorHandling    string   `json:"errorHandling"`
	Pagination       string   `json:"pagination,omitempty"`
	Webhooks         bool     `json:"webhooks"`
	BestPractices    []string `json:"bestPractices"`
	Endpoints        []struct {
		Path        string `json:"path"`
		Method      string `json:"method"`
		Description string `json:"description"`
		Category    string `json:"category"`
	} `json:"endpoints"`
}

// Connector Generation Request
type ConnectorGenerationRequest struct {
	Name              string                 `json:"name" binding:"required"`
	SpecType          string                 `json:"specType" binding:"required,oneof=openapi graphql postman"`
	Spec              interface{}            `json:"spec" binding:"required"`
	Language          string                 `json:"language" binding:"required,oneof=typescript go python"`
	Runtime           string                 `json:"runtime" binding:"required,oneof=cloudflare-workers vercel lambda docker"`
	AuthConfig        *AuthConfig            `json:"authConfig,omitempty"`
	SelectedEndpoints []string               `json:"selectedEndpoints,omitempty"`
	Customizations    map[string]interface{} `json:"customizations,omitempty"`
}

type AuthConfig struct {
	Type   string                 `json:"type" binding:"required,oneof=apikey oauth jwt none"`
	Config map[string]interface{} `json:"config"`
}

// Connector Generation Response
type ConnectorGenerationResponse struct {
	JobID       string `json:"jobId"`
	Status      string `json:"status"`
	Message     string `json:"message"`
	EstimatedMS int    `json:"estimatedMs"`
}

// Test Generation Request
type TestGenerationRequest struct {
	ConnectorID string `json:"connectorId" binding:"required"`
	Language    string `json:"language" binding:"required,oneof=typescript go python"`
}

// Test Generation Response
type TestGenerationResponse struct {
	JobID       string `json:"jobId"`
	Status      string `json:"status"`
	Message     string `json:"message"`
	EstimatedMS int    `json:"estimatedMs"`
}

// Connector Validation Request
type ConnectorValidationRequest struct {
	ConnectorID string `json:"connectorId" binding:"required"`
}

// Connector Validation Response
type ConnectorValidationResponse struct {
	Valid   bool `json:"valid"`
	Issues  []struct {
		Severity   string `json:"severity"`
		Message    string `json:"message"`
		Location   string `json:"location,omitempty"`
		Suggestion string `json:"suggestion,omitempty"`
	} `json:"issues"`
	TestResults struct {
		Passed   int `json:"passed"`
		Failed   int `json:"failed"`
		Skipped  int `json:"skipped"`
		Duration int `json:"duration"`
	} `json:"testResults"`
	Performance struct {
		AvgResponseTime float64 `json:"avgResponseTime"`
		P95ResponseTime float64 `json:"p95ResponseTime"`
		P99ResponseTime float64 `json:"p99ResponseTime"`
	} `json:"performance"`
}

// Connector Fix Request
type ConnectorFixRequest struct {
	ConnectorID string `json:"connectorId" binding:"required"`
	Error       struct {
		Message     string      `json:"message" binding:"required"`
		Stack       string      `json:"stack,omitempty"`
		APIResponse interface{} `json:"apiResponse,omitempty"`
	} `json:"error" binding:"required"`
}

// Connector Fix Response
type ConnectorFixResponse struct {
	Fixed       bool     `json:"fixed"`
	FixedCode   string   `json:"fixedCode,omitempty"`
	Explanation string   `json:"explanation"`
	Confidence  float64  `json:"confidence"`
	Changes     []string `json:"changes"`
}

// Job Status Response
type JobStatusResponse struct {
	JobID     string      `json:"jobId"`
	Status    string      `json:"status"` // pending, processing, completed, failed
	Progress  int         `json:"progress"` // 0-100
	Result    interface{} `json:"result,omitempty"`
	Error     string      `json:"error,omitempty"`
	CreatedAt string      `json:"createdAt"`
	UpdatedAt string      `json:"updatedAt"`
}

// GenerateFromNaturalLanguage handles natural language connector generation
// POST /api/v1/ai/generate/natural-language
func (h *AIHandler) GenerateFromNaturalLanguage(c *gin.Context) {
	var req NLGenerationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	req.UserID = userID.(string)

	logging.Info("Natural language connector generation requested",
		zap.String("userId", req.UserID),
		zap.String("description", req.Description[:min(100, len(req.Description))]),
	)

	// Create async job
	job, err := h.openhandsService.CreateNLGenerationJob(req)
	if err != nil {
		logging.Error("Failed to create NL generation job", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start generation", "details": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, NLGenerationResponse{
		JobID:       job.ID,
		Status:      "pending",
		Message:     "Natural language connector generation started",
		EstimatedMS: 180000, // 3 minutes estimated
	})
}

// AnalyzeAPI handles API specification analysis
// POST /api/v1/ai/analyze
func (h *AIHandler) AnalyzeAPI(c *gin.Context) {
	var req APIAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	logging.Info("API analysis requested",
		zap.String("specType", req.SpecType),
	)

	// Call OpenHands service to analyze API
	analysis, err := h.openhandsService.AnalyzeAPI(req)
	if err != nil {
		logging.Error("Failed to analyze API", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze API", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, analysis)
}

// GenerateConnector handles AI-powered connector generation
// POST /api/v1/ai/generate/connector
func (h *AIHandler) GenerateConnector(c *gin.Context) {
	var req ConnectorGenerationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	logging.Info("AI connector generation requested",
		zap.String("userId", userID.(string)),
		zap.String("name", req.Name),
		zap.String("language", req.Language),
		zap.String("runtime", req.Runtime),
	)

	// Create async job
	job, err := h.openhandsService.CreateConnectorGenerationJob(userID.(string), req)
	if err != nil {
		logging.Error("Failed to create connector generation job", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start generation", "details": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, ConnectorGenerationResponse{
		JobID:       job.ID,
		Status:      "pending",
		Message:     "AI connector generation started",
		EstimatedMS: 120000, // 2 minutes estimated
	})
}

// GenerateTests handles AI-powered test generation
// POST /api/v1/ai/generate/tests
func (h *AIHandler) GenerateTests(c *gin.Context) {
	var req TestGenerationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	logging.Info("AI test generation requested",
		zap.String("userId", userID.(string)),
		zap.String("connectorId", req.ConnectorID),
	)

	// Create async job
	job, err := h.openhandsService.CreateTestGenerationJob(userID.(string), req)
	if err != nil {
		logging.Error("Failed to create test generation job", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start test generation", "details": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, TestGenerationResponse{
		JobID:       job.ID,
		Status:      "pending",
		Message:     "AI test generation started",
		EstimatedMS: 60000, // 1 minute estimated
	})
}

// ValidateConnector handles AI-powered connector validation
// POST /api/v1/ai/validate
func (h *AIHandler) ValidateConnector(c *gin.Context) {
	var req ConnectorValidationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	logging.Info("Connector validation requested",
		zap.String("userId", userID.(string)),
		zap.String("connectorId", req.ConnectorID),
	)

	// Validate connector using OpenHands
	validation, err := h.openhandsService.ValidateConnector(userID.(string), req.ConnectorID)
	if err != nil {
		logging.Error("Failed to validate connector", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate connector", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, validation)
}

// FixConnector handles AI-powered connector fixing
// POST /api/v1/ai/fix
func (h *AIHandler) FixConnector(c *gin.Context) {
	var req ConnectorFixRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	logging.Info("Connector fix requested",
		zap.String("userId", userID.(string)),
		zap.String("connectorId", req.ConnectorID),
		zap.String("error", req.Error.Message),
	)

	// Fix connector using OpenHands
	fix, err := h.openhandsService.FixConnector(userID.(string), req)
	if err != nil {
		logging.Error("Failed to fix connector", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fix connector", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, fix)
}

// GetJobStatus handles job status queries
// GET /api/v1/ai/jobs/:jobId
func (h *AIHandler) GetJobStatus(c *gin.Context) {
	jobID := c.Param("jobId")
	if jobID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Job ID is required"})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	status, err := h.openhandsService.GetJobStatus(userID.(string), jobID)
	if err != nil {
		logging.Error("Failed to get job status", zap.Error(err), zap.String("jobId", jobID))
		c.JSON(http.StatusNotFound, gin.H{"error": "Job not found", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

// GenerateDocumentation handles AI-powered documentation generation
// POST /api/v1/ai/generate/documentation
func (h *AIHandler) GenerateDocumentation(c *gin.Context) {
	var req struct {
		ConnectorID string `json:"connectorId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request", "details": err.Error()})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	logging.Info("Documentation generation requested",
		zap.String("userId", userID.(string)),
		zap.String("connectorId", req.ConnectorID),
	)

	// Create async job
	job, err := h.openhandsService.CreateDocumentationJob(userID.(string), req.ConnectorID)
	if err != nil {
		logging.Error("Failed to create documentation job", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start documentation generation", "details": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"jobId":       job.ID,
		"status":      "pending",
		"message":     "Documentation generation started",
		"estimatedMs": 45000, // 45 seconds estimated
	})
}

// Helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
