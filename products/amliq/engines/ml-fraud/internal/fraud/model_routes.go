package fraud

import "github.com/gin-gonic/gin"

// RegisterModelRoutes registers ML model management and A/B testing routes.
// Applies standard middleware: RequestID, RateLimit, and JSON body validation.
func RegisterModelRoutes(
	router *gin.RouterGroup,
	modelRepo ModelRepository,
	abTestSvc ABTestService,
) {
	handler := NewModelHandler(modelRepo, abTestSvc)

	// Read-only model endpoints (240 req/min)
	readOnly := router.Group("/models")
	readOnly.Use(RequestIDMiddleware())
	readOnly.Use(RateLimitMiddleware(240))
	readOnly.GET("", handler.ListModels)
	readOnly.GET("/compare", handler.CompareModels)
	readOnly.GET("/:id", handler.GetModel)

	// Mutating model endpoints (120 req/min)
	mutating := router.Group("/models")
	mutating.Use(RequestIDMiddleware())
	mutating.Use(RateLimitMiddleware(120))
	mutating.Use(JSONContentTypeAndBodyLimitMiddleware(1 << 20))
	mutating.POST("", handler.CreateModel)
	mutating.PUT("/:id/status", handler.UpdateModelStatus)

	// A/B test read endpoints (240 req/min)
	abtestRead := router.Group("/models/abtest")
	abtestRead.Use(RequestIDMiddleware())
	abtestRead.Use(RateLimitMiddleware(240))
	abtestRead.GET("/active", handler.GetActiveABTest)

	// A/B test write endpoints (120 req/min)
	abtestWrite := router.Group("/models/abtest")
	abtestWrite.Use(RequestIDMiddleware())
	abtestWrite.Use(RateLimitMiddleware(120))
	abtestWrite.Use(JSONContentTypeAndBodyLimitMiddleware(1 << 20))
	abtestWrite.POST("", handler.CreateABTest)
	abtestWrite.POST("/stop", handler.StopABTest)
}
