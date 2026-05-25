package fraud

import (
	"github.com/gin-gonic/gin"
)

// RegisterPatternRoutes registers pattern sharing API endpoints.
// Read endpoints get 240 req/min, write endpoints get 120 req/min.
func RegisterPatternRoutes(router *gin.RouterGroup, service PatternSharingService) {
	handler := NewPatternHandler(service)

	// Read-only endpoints
	readGroup := router.Group("/patterns")
	readGroup.Use(RequestIDMiddleware())
	readGroup.Use(RateLimitMiddleware(240))
	readGroup.GET("/aggregate", handler.GetAggregatePatterns)
	readGroup.GET("/config", handler.GetTenantConfig)
	readGroup.GET("/stats", handler.GetAggregateStats)

	// Write endpoints
	writeGroup := router.Group("/patterns")
	writeGroup.Use(RequestIDMiddleware())
	writeGroup.Use(RateLimitMiddleware(120))
	writeGroup.Use(JSONContentTypeAndBodyLimitMiddleware(1 << 20)) // 1 MiB
	writeGroup.POST("/contribute", handler.ContributePatterns)
	writeGroup.PUT("/config", handler.UpdateTenantConfig)
}
