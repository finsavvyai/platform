package ports

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/domain"
)

// AIRepository defines the interface for AI data persistence
type AIRepository interface {
	// AI Config operations
	CreateAIConfig(ctx context.Context, config *domain.AIConfig) error
	GetAIConfig(ctx context.Context, service domain.AIService) (*domain.AIConfig, error)
	UpdateAIConfig(ctx context.Context, config *domain.AIConfig) error
	DeleteAIConfig(ctx context.Context, service domain.AIService) error
	ListAIConfigs(ctx context.Context) ([]*domain.AIConfig, error)

	// AI Request/Response operations
	CreateAIRequest(ctx context.Context, request *domain.AIRequest) error
	GetAIRequest(ctx context.Context, id string) (*domain.AIRequest, error)
	CreateAIResponse(ctx context.Context, response *domain.AIResponse) error
	GetAIResponse(ctx context.Context, id string) (*domain.AIResponse, error)
	ListAIRequests(ctx context.Context, userID string, limit, offset int) ([]*domain.AIRequest, error)
	ListAIResponses(ctx context.Context, userID string, limit, offset int) ([]*domain.AIResponse, error)

	// NL to SQL operations
	CreateNLToSQLRequest(ctx context.Context, request *domain.NLToSQLRequest) error
	GetNLToSQLRequest(ctx context.Context, id string) (*domain.NLToSQLRequest, error)
	CreateNLToSQLResponse(ctx context.Context, response *domain.NLToSQLResponse) error
	GetNLToSQLResponse(ctx context.Context, id string) (*domain.NLToSQLResponse, error)
	ListNLToSQLRequests(ctx context.Context, userID string, limit, offset int) ([]*domain.NLToSQLRequest, error)

	// Query Optimization operations
	CreateQueryOptimizationRequest(ctx context.Context, request *domain.QueryOptimizationRequest) error
	GetQueryOptimizationRequest(ctx context.Context, id string) (*domain.QueryOptimizationRequest, error)
	CreateQueryOptimizationResponse(ctx context.Context, response *domain.QueryOptimizationResponse) error
	GetQueryOptimizationResponse(ctx context.Context, id string) (*domain.QueryOptimizationResponse, error)

	// Query Explanation operations
	CreateQueryExplanationRequest(ctx context.Context, request *domain.QueryExplanationRequest) error
	GetQueryExplanationRequest(ctx context.Context, id string) (*domain.QueryExplanationRequest, error)
	CreateQueryExplanationResponse(ctx context.Context, response *domain.QueryExplanationResponse) error
	GetQueryExplanationResponse(ctx context.Context, id string) (*domain.QueryExplanationResponse, error)

	// Usage tracking operations
	CreateAIUsage(ctx context.Context, usage *domain.AIUsage) error
	GetAIUsage(ctx context.Context, userID string, startDate, endDate time.Time) ([]*domain.AIUsage, error)
	GetAIUsageByService(ctx context.Context, service domain.AIService, startDate, endDate time.Time) ([]*domain.AIUsage, error)

	// Prompt template operations
	CreateAIPromptTemplate(ctx context.Context, template *domain.AIPromptTemplate) error
	GetAIPromptTemplate(ctx context.Context, id string) (*domain.AIPromptTemplate, error)
	ListAIPromptTemplates(ctx context.Context, service domain.AIService, operation string) ([]*domain.AIPromptTemplate, error)
	UpdateAIPromptTemplate(ctx context.Context, template *domain.AIPromptTemplate) error
	DeleteAIPromptTemplate(ctx context.Context, id string) error
}

// AIService defines the interface for AI service operations
type AIService interface {
	// Basic AI operations
	GenerateResponse(ctx context.Context, request *domain.AIRequest) (*domain.AIResponse, error)

	// Natural Language to SQL conversion
	ConvertNLToSQL(ctx context.Context, request *domain.NLToSQLRequest) (*domain.NLToSQLResponse, error)

	// Query optimization
	OptimizeQuery(ctx context.Context, request *domain.QueryOptimizationRequest) (*domain.QueryOptimizationResponse, error)

	// Query explanation
	ExplainQuery(ctx context.Context, request *domain.QueryExplanationRequest) (*domain.QueryExplanationResponse, error)

	// Query generation
	GenerateQuery(ctx context.Context, request *domain.QueryGenerationRequest) (*domain.QueryGenerationResponse, error)

	// Performance analysis
	AnalyzePerformance(ctx context.Context, request *domain.PerformanceAnalysisRequest) (*domain.PerformanceAnalysisResponse, error)

	// Service management
	GetServiceType() domain.AIService
	IsHealthy(ctx context.Context) error
	GetRateLimit() int
	GetRemainingTokens(ctx context.Context) (int, error)
}

// RateLimiter defines the interface for AI service rate limiting
type RateLimiter interface {
	Allow(ctx context.Context, userID string, service domain.AIService) (bool, time.Duration)
	GetLimit(ctx context.Context, userID string, service domain.AIService) (int, error)
	GetUsage(ctx context.Context, userID string, service domain.AIService) (int, error)
	Reset(ctx context.Context, userID string, service domain.AIService) error
}

// TokenTracker defines the interface for tracking AI token usage
type TokenTracker interface {
	TrackUsage(ctx context.Context, userID string, service domain.AIService, tokensUsed int, cost float64) error
	GetUsage(ctx context.Context, userID string, service domain.AIService, startDate, endDate time.Time) (int, float64, error)
	GetUsageByOperation(ctx context.Context, userID string, service domain.AIService, operation string, startDate, endDate time.Time) (int, float64, error)
	SetBudget(ctx context.Context, userID string, service domain.AIService, budget float64) error
	GetBudget(ctx context.Context, userID string, service domain.AIService) (float64, error)
	CheckBudget(ctx context.Context, userID string, service domain.AIService, estimatedCost float64) (bool, error)
}

// PromptTemplateManager defines the interface for managing AI prompt templates
type PromptTemplateManager interface {
	LoadTemplate(ctx context.Context, service domain.AIService, operation string) (*domain.AIPromptTemplate, error)
	RenderTemplate(ctx context.Context, template *domain.AIPromptTemplate, variables map[string]interface{}) (string, error)
	ValidateTemplate(ctx context.Context, template *domain.AIPromptTemplate) error
	UpdateTemplate(ctx context.Context, template *domain.AIPromptTemplate) error
}

// CacheManager defines the interface for caching AI responses
type CacheManager interface {
	Get(ctx context.Context, key string) (interface{}, error)
	Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
	Clear(ctx context.Context, pattern string) error
	GetStats(ctx context.Context) (map[string]interface{}, error)
}

// AIHealthChecker defines the interface for checking AI service health
type AIHealthChecker interface {
	CheckHealth(ctx context.Context, service domain.AIService) error
	GetHealthStatus(ctx context.Context) (map[domain.AIService]error, error)
	SetHealthCallback(ctx context.Context, service domain.AIService, callback func(error)) error
}

// ExternalAIAPIClient defines the interface for external AI API clients
type ExternalAIAPIClient interface {
	// API operations
	MakeRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (*interface{}, error)
	StreamRequest(ctx context.Context, endpoint string, payload interface{}, headers map[string]string) (<-chan []byte, error)

	// Configuration
	SetAPIKey(apiKey string)
	SetBaseURL(baseURL string)
	SetTimeout(timeout time.Duration)

	// Validation
	ValidateAPIKey(ctx context.Context) error
	ValidateConfiguration() error

	// Rate limiting
	GetRateLimitInfo(ctx context.Context) (map[string]interface{}, error)
	ResetRateLimit(ctx context.Context) error
}

// AIMonitoringService defines the interface for AI service monitoring
type AIMonitoringService interface {
	// Metrics collection
	RecordRequest(ctx context.Context, service domain.AIService, operation string, duration time.Duration, tokensUsed int, success bool)
	RecordError(ctx context.Context, service domain.AIService, operation string, error string)
	RecordLatency(ctx context.Context, service domain.AIService, operation string, latency time.Duration)

	// Metrics retrieval
	GetMetrics(ctx context.Context, service domain.AIService, timeRange time.Duration) (map[string]interface{}, error)
	GetErrorRate(ctx context.Context, service domain.AIService, timeRange time.Duration) (float64, error)
	GetAverageLatency(ctx context.Context, service domain.AIService, operation string, timeRange time.Duration) (time.Duration, error)
	GetTokenUsage(ctx context.Context, service domain.AIService, timeRange time.Duration) (int, error)

	// Alerting
	SetAlertThreshold(ctx context.Context, service domain.AIService, metric string, threshold float64) error
	CheckAlerts(ctx context.Context) ([]map[string]interface{}, error)
}

// AuditLogger defines the interface for AI audit logging
type AuditLogger interface {
	LogRequest(ctx context.Context, request *domain.AIRequest) error
	LogResponse(ctx context.Context, response *domain.AIResponse) error
	LogError(ctx context.Context, requestID string, error error) error
	LogDataAccess(ctx context.Context, userID string, operation string, dataAccessed interface{}) error

	// Audit retrieval
	GetAuditLogs(ctx context.Context, userID string, startDate, endDate time.Time) ([]interface{}, error)
	GetAuditLogsByOperation(ctx context.Context, operation string, startDate, endDate time.Time) ([]interface{}, error)
	GetAuditLogsByService(ctx context.Context, service domain.AIService, startDate, endDate time.Time) ([]interface{}, error)
}

// EncryptionService defines the interface for encrypting sensitive AI data
type EncryptionService interface {
	EncryptAPIKey(ctx context.Context, apiKey string) (string, error)
	DecryptAPIKey(ctx context.Context, encryptedKey string) (string, error)
	EncryptRequest(ctx context.Context, request interface{}) (string, error)
	DecryptRequest(ctx context.Context, encryptedRequest string) (interface{}, error)
	EncryptResponse(ctx context.Context, response interface{}) (string, error)
	DecryptResponse(ctx context.Context, encryptedResponse string) (interface{}, error)
}
