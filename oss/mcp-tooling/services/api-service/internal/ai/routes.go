package ai

import (
	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/middleware"
)

// RegisterRoutes registers AI-powered API routes
func RegisterRoutes(router *gin.RouterGroup, cfg *config.Config) {
	handler := NewAIHandler(cfg)

	// AI routes group
	ai := router.Group("/ai")
	ai.Use(middleware.RequireAuth()) // All AI routes require authentication

	// Apply AI-specific rate limiting (more restrictive than general API)
	// AI operations are expensive, so we limit them more aggressively
	aiRateLimitConfig := middleware.DefaultRateLimitConfig()
	aiRateLimitConfig.RequestsPerWindow = 10 // 10 requests per minute for AI operations

	{
		// Natural Language Connector Generation
		// POST /api/v1/ai/generate/natural-language
		// Body: { "description": "Create a connector for Stripe API..." }
		ai.POST("/generate/natural-language", handler.GenerateFromNaturalLanguage)

		// API Analysis
		// POST /api/v1/ai/analyze
		// Body: { "specType": "openapi", "spec": {...} }
		ai.POST("/analyze", handler.AnalyzeAPI)

		// Connector Generation
		// POST /api/v1/ai/generate/connector
		// Body: { "name": "stripe-connector", "specType": "openapi", "spec": {...}, "language": "typescript", "runtime": "cloudflare-workers" }
		ai.POST("/generate/connector", handler.GenerateConnector)

		// Test Generation
		// POST /api/v1/ai/generate/tests
		// Body: { "connectorId": "uuid", "language": "typescript" }
		ai.POST("/generate/tests", handler.GenerateTests)

		// Documentation Generation
		// POST /api/v1/ai/generate/documentation
		// Body: { "connectorId": "uuid" }
		ai.POST("/generate/documentation", handler.GenerateDocumentation)

		// Connector Validation
		// POST /api/v1/ai/validate
		// Body: { "connectorId": "uuid" }
		ai.POST("/validate", handler.ValidateConnector)

		// Connector Fix
		// POST /api/v1/ai/fix
		// Body: { "connectorId": "uuid", "error": { "message": "...", "stack": "..." } }
		ai.POST("/fix", handler.FixConnector)

		// Job Status
		// GET /api/v1/ai/jobs/:jobId
		ai.GET("/jobs/:jobId", handler.GetJobStatus)
	}
}
