package oauth

import (
	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/middleware"
)

// SetupRoutes registers OAuth routes
func (h *Handlers) SetupRoutes(r *gin.RouterGroup) {
	oauth := r.Group("/oauth")
	{
		// Public routes
		oauth.GET("/providers", h.GetProviders)
		oauth.GET("/config", h.GetOAuthConfig)
		oauth.GET("/:provider_id/webhook", h.Webhook) // Webhook for provider events

		// Protected routes (require authentication)
		protected := oauth.Group("", middleware.RequireAuth())
		{
			// Authorization flow
			protected.POST("/authorize", h.GetAuthURL)
			protected.GET("/callback", h.HandleCallback)
			protected.POST("/validate", h.ValidateToken)
			protected.POST("/revoke", h.RevokeToken)

			// Connection management
			protected.GET("/connections", h.ListConnections)
			protected.GET("/connections/:provider_id", h.GetConnection)
			protected.DELETE("/connections/:provider_id", h.DeleteConnection)
			protected.POST("/connections/:provider_id/refresh", h.RefreshToken)

			// Connector-specific OAuth
			protected.POST("/connect", h.ConnectConnector)
			protected.GET("/connectors/:connector_id/connections", h.ListConnectorConnections)
		}
	}
}

// SetupAPIRoutes registers OAuth API routes (v1)
func (h *Handlers) SetupAPIRoutes(r *gin.RouterGroup) {
	api := r.Group("/api/v1/oauth")
	{
		// Public endpoints
		api.GET("/providers", h.GetProviders)
		api.GET("/config", h.GetOAuthConfig)
		api.GET("/:provider_id/webhook", h.Webhook)

		// Protected endpoints
		protected := api.Group("", middleware.RequireAuth())
		{
			// Authorization flow
			protected.POST("/authorize", h.GetAuthURL)
			protected.GET("/callback", h.HandleCallback)
			protected.POST("/validate", h.ValidateToken)
			protected.POST("/revoke", h.RevokeToken)

			// Connection management
			protected.GET("/connections", h.ListConnections)
			protected.GET("/connections/:provider_id", h.GetConnection)
			protected.DELETE("/connections/:provider_id", h.DeleteConnection)
			protected.POST("/connections/:provider_id/refresh", h.RefreshToken)

			// Connector integration
			protected.POST("/connect", h.ConnectConnector)
			protected.GET("/connectors/:connector_id/connections", h.ListConnectorConnections)
		}
	}
}

// SetupConnectorRoutes registers OAuth routes for connector management
func (h *Handlers) SetupConnectorRoutes(r *gin.RouterGroup) {
	connector := r.Group("/connectors/:connector_id/oauth")
	{
		// These require authentication
		protected := connector.Group("", middleware.RequireAuth())
		{
			// Connect a connector with OAuth
			protected.POST("/authorize", h.ConnectConnector)
			protected.GET("/connections", h.ListConnectorConnections)
			protected.DELETE("/connections/:provider_id", h.DeleteConnection)
			protected.POST("/connections/:provider_id/refresh", h.RefreshToken)
		}
	}
}

// SetupMiddlewareRoutes registers OAuth middleware routes
func (h *Handlers) SetupMiddlewareRoutes(r *gin.RouterGroup) {
	// OAuth token validation middleware endpoint
	r.POST("/oauth/validate-token", h.ValidateToken)

	// OAuth token refresh middleware endpoint
	r.POST("/oauth/refresh-token", h.RefreshToken)
}
