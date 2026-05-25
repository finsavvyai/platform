package fraud

import (
	"github.com/gin-gonic/gin"
)

// RegisterGraphRoutes registers the fraud network graph API endpoints.
// All routes live under /v1/fraud-rings/graph/* with read-only middleware.
func RegisterGraphRoutes(router *gin.RouterGroup, repo GraphRepository) {
	handler := NewGraphHandler(repo)

	graphGroup := router.Group("/fraud-rings/graph")
	graphGroup.Use(RequestIDMiddleware())
	graphGroup.Use(RateLimitMiddleware(240)) // 240 req/min for reads

	graphGroup.GET("", handler.QueryGraph)
	graphGroup.GET("/stats", handler.GetGraphStats)
	graphGroup.GET("/nodes/:id", handler.GetNodeDetail)
	graphGroup.GET("/communities/:id", handler.GetCommunityDetail)
}
