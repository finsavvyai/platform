package server

import "github.com/gin-gonic/gin"

// setupRoutes configures all routes for the server
func (s *Server) setupRoutes() {
	s.router.GET("/health", s.healthCheck)

	v1 := s.router.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/register", s.register)
			auth.POST("/login", s.login)
			auth.POST("/logout", s.logout)
			auth.POST("/refresh", s.refreshToken)
		}

		protected := v1.Group("/")
		protected.Use(s.AuthMiddleware())
		{
			s.registerUserRoutes(protected)
			s.registerConnectionRoutes(protected)
			s.registerQueryRoutes(protected)
			s.registerMetricsRoutes(protected)
			s.registerAlertRoutes(protected)
			s.registerAIRoutes(protected)
			s.registerSubscriptionRoutes(protected)
			s.registerWebSocketRoutes(protected)
		}

		webhooks := v1.Group("/webhooks")
		{
			webhooks.POST("/lemonsqueezy", s.subscriptionHandler.HandleWebhook)
		}
	}
}

func (s *Server) registerUserRoutes(group *gin.RouterGroup) {
	users := group.Group("/users")
	{
		users.GET("/profile", s.getUserProfile)
		users.PUT("/profile", s.updateUserProfile)
	}
}

func (s *Server) registerConnectionRoutes(group *gin.RouterGroup) {
	connections := group.Group("/connections")
	{
		connections.GET("/", s.getConnections)
		connections.POST("/", s.createConnection)
		connections.GET("/:id", s.getConnection)
		connections.PUT("/:id", s.updateConnection)
		connections.DELETE("/:id", s.deleteConnection)
		connections.POST("/:id/test", s.testConnection)
		connections.POST("/:id/query", s.executeQuery)
		connections.GET("/:id/schema", s.getSchema)
		connections.GET("/:id/history", s.getQueryHistory)
		connections.POST("/:id/explain", s.explainQuery)
	}
}

func (s *Server) registerQueryRoutes(group *gin.RouterGroup) {
	queries := group.Group("/queries")
	{
		queries.GET("/", s.getQueries)
		queries.GET("/:id", s.getQuery)
		queries.DELETE("/:id", s.deleteQuery)
		queries.GET("/history", s.getUserQueryHistory)
	}
}

func (s *Server) registerMetricsRoutes(group *gin.RouterGroup) {
	metrics := group.Group("/metrics")
	{
		metrics.GET("/connections/:id", s.getConnectionMetrics)
		metrics.GET("/connections/:id/history", s.getMetricsHistory)
	}
}

func (s *Server) registerAlertRoutes(group *gin.RouterGroup) {
	alerts := group.Group("/alerts")
	{
		alerts.GET("/", s.getAlerts)
		alerts.GET("/:id", s.getAlert)
		alerts.PUT("/:id/resolve", s.resolveAlert)
		alerts.PUT("/:id/mute", s.muteAlert)
	}
}

func (s *Server) registerAIRoutes(group *gin.RouterGroup) {
	ai := group.Group("/ai")
	{
		ai.POST("/nl-to-sql", s.convertNLToSQL)
		ai.POST("/optimize-query", s.optimizeQuery)
		ai.POST("/explain-query", s.explainQueryAI)
		ai.POST("/generate-query", s.generateQuery)
		ai.POST("/analyze-performance", s.analyzePerformance)
		ai.POST("/batch", s.batchProcessAIRequests)
		ai.GET("/status", s.getAIStatus)
	}
}

func (s *Server) registerSubscriptionRoutes(group *gin.RouterGroup) {
	subscriptions := group.Group("/subscriptions")
	{
		subscriptions.POST("/checkout", s.subscriptionHandler.CreateCheckout)
		subscriptions.GET("/current", s.subscriptionHandler.GetSubscription)
		subscriptions.POST("/cancel", s.subscriptionHandler.CancelSubscription)
		subscriptions.POST("/pause", s.subscriptionHandler.PauseSubscription)
		subscriptions.POST("/resume", s.subscriptionHandler.ResumeSubscription)
		subscriptions.POST("/change-plan", s.subscriptionHandler.ChangePlan)
		subscriptions.GET("/usage", s.subscriptionHandler.GetUsageStats)
		subscriptions.GET("/check-access", s.subscriptionHandler.CheckFeatureAccess)
		subscriptions.GET("/plans", s.subscriptionHandler.GetAvailablePlans)
		subscriptions.GET("/invoices", s.subscriptionHandler.GetInvoices)
		subscriptions.GET("/invoices/:id", s.subscriptionHandler.GetInvoice)
	}
}

func (s *Server) registerWebSocketRoutes(group *gin.RouterGroup) {
	ws := group.Group("/ws")
	{
		ws.GET("/connect", s.handleWebSocketConnection)
		ws.GET("/stats", s.getWebSocketStats)
	}
}
