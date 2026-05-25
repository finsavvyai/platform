package handlers

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"github.com/mcpoverflow/api-service/internal/ai"
	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/middleware"
	"github.com/mcpoverflow/api-service/internal/services"
)

func SetupRoutes(router *gin.Engine, cfg *config.Config, db *gorm.DB) {
	// Initialize domain middleware
	domainMiddleware := middleware.NewDomainMiddleware(cfg)

	// Apply domain detection middleware globally
	router.Use(domainMiddleware.Handle())

	// Apply security and SEO middlewares
	router.Use(domainMiddleware.SecurityHeaders())
	router.Use(domainMiddleware.CORS())
	router.Use(domainMiddleware.SEOHeaders())

	// Initialize services
	connectorService := services.NewConnectorService(db)
	
	// Initialize handlers
	domainHandler := NewDomainHandler(cfg)
	connectorHandler := NewConnectorHandler(connectorService)

	// SEO and domain-specific routes
	router.GET("/sitemap.xml", domainHandler.GetSitemap)
	router.GET("/robots.txt", domainHandler.GetRobotsTxt)
	router.GET("/opengraph", domainHandler.GetOpenGraph)
	router.GET("/structured-data/:page", domainHandler.GetStructuredData)

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		domain, _ := c.Get("domain")
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "mcpoverflow-api",
			"version": "0.1.0",
			"domain":  domain,
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Authentication routes
		auth := v1.Group("/auth")
		{
			auth.POST("/login", LoginHandler(cfg))
			auth.POST("/register", RegisterHandler(cfg))
			auth.POST("/logout", LogoutHandler(cfg))
			auth.GET("/me", middleware.RequireAuth(), MeHandler(cfg))
		}

		// Connector routes (supports both JWT and API key auth)
		connectors := v1.Group("/connectors")
		{
			// Routes that accept either JWT or API key
			connectors.GET("", middleware.RequireAuthOrAPIKey("connectors:read"), connectorHandler.ListConnectors)
			connectors.GET("/:id", middleware.RequireAuthOrAPIKey("connectors:read"), connectorHandler.GetConnector)

			// Routes that require JWT auth only
			connectorsWithAuth := connectors.Group("")
			connectorsWithAuth.Use(middleware.RequireAuth())
			{
				connectorsWithAuth.POST("", connectorHandler.CreateConnector)
				connectorsWithAuth.PUT("/:id", connectorHandler.UpdateConnector)
				connectorsWithAuth.DELETE("/:id", connectorHandler.DeleteConnector)
				connectorsWithAuth.POST("/:id/deploy", connectorHandler.DeployConnector)
			}
		}

		// Parser routes
		parserGroup := v1.Group("/parser")
		{
			// OpenAPI routes
			parserGroup.POST("/openapi/parse", middleware.RequireAuthOrAPIKey("parser:parse"), ParseOpenAPISpecHandler(cfg))
			parserGroup.POST("/openapi/validate", middleware.RequireAuthOrAPIKey("parser:validate"), ValidateOpenAPISpecHandler(cfg))
			parserGroup.POST("/openapi/endpoints", middleware.RequireAuthOrAPIKey("parser:endpoints"), ExtractEndpointsHandler(cfg))
			parserGroup.POST("/openapi/mcp-schema", middleware.RequireAuthOrAPIKey("parser:mcp"), GenerateMCPSchemaHandler(cfg))

			// GraphQL routes
			parserGroup.POST("/graphql/parse", middleware.RequireAuthOrAPIKey("parser:parse"), ParseGraphQLSchemaHandler(cfg))
			parserGroup.POST("/graphql/validate", middleware.RequireAuthOrAPIKey("parser:validate"), ValidateGraphQLSchemaHandler(cfg))
			parserGroup.POST("/graphql/operations", middleware.RequireAuthOrAPIKey("parser:endpoints"), ExtractGraphQLOperationsHandler(cfg))
			parserGroup.POST("/graphql/mcp-schema", middleware.RequireAuthOrAPIKey("parser:mcp"), GenerateGraphQLMCPSchemaHandler(cfg))

			// Postman routes
			parserGroup.POST("/postman/parse", middleware.RequireAuthOrAPIKey("parser:parse"), ParsePostmanCollectionHandler(cfg))
			parserGroup.POST("/postman/validate", middleware.RequireAuthOrAPIKey("parser:validate"), ValidatePostmanCollectionHandler(cfg))
			parserGroup.POST("/postman/requests", middleware.RequireAuthOrAPIKey("parser:endpoints"), ExtractPostmanRequestsHandler(cfg))
			parserGroup.POST("/postman/mcp-schema", middleware.RequireAuthOrAPIKey("parser:mcp"), GeneratePostmanMCPSchemaHandler(cfg))
		}

		// Generation routes
		generation := v1.Group("/generation")
		generation.Use(middleware.RequireAuth())
		{
			generation.POST("/parse", ParseSpecHandler(cfg))
			generation.POST("/generate", GenerateHandler(cfg))
			generation.GET("/status/:jobId", GetGenerationStatusHandler(cfg))
		}

		// AgentKit routes
		agents := v1.Group("/agents")
		agents.Use(middleware.RequireAuth())
		{
			agents.GET("", GetAgentsHandler(cfg))
			agents.POST("/:connectorId/register", RegisterAgentHandler(cfg))
			agents.DELETE("/:agentId", UnregisterAgentHandler(cfg))
			agents.GET("/:agentId/status", GetAgentStatusHandler(cfg))
		}

		// API Key routes
		apiKeys := v1.Group("/api-keys")
		apiKeys.Use(middleware.RequireAuth())
		{
			apiKeys.GET("", GetAPIKeysHandler(cfg))
			apiKeys.POST("", CreateAPIKeyHandler(cfg))
			apiKeys.DELETE("/:keyId", RevokeAPIKeyHandler(cfg))
		}

		// Analytics routes
		analytics := v1.Group("/analytics")
		analytics.Use(middleware.RequireAuth())
		{
			analytics.GET("/dashboard", GetDashboardAnalyticsHandler(cfg))
			analytics.GET("/connectors/:id/metrics", GetConnectorMetricsHandler(cfg))
		}

		// Domain management routes
		domainRoutes := v1.Group("/domain")
		{
			// Public routes
			domainRoutes.GET("/config", domainHandler.GetDomainConfig)
			domainRoutes.GET("/analytics", domainHandler.GetDomainAnalytics)
			domainRoutes.GET("/health", domainHandler.GetDomainHealth)

			// Admin routes (require authentication)
			domainAdmin := domainRoutes.Group("")
			domainAdmin.Use(middleware.RequireAuth())
			{
				domainAdmin.GET("/list", domainHandler.ListDomains)
				domainAdmin.POST("/config", domainHandler.UpdateDomainConfig)
				domainAdmin.GET("/validate", domainHandler.ValidateDomain)
			}
		}


		// Enterprise & Payment routes
		enterpriseHandler := NewEnterpriseHandler(cfg)
		enterprise := v1.Group("/enterprise")
		{
			enterprise.POST("/demo", enterpriseHandler.RequestDemo)
			enterprise.GET("/dedicated-config", enterpriseHandler.GetDedicatedConfig)
			
			// Payment routes
			payments := enterprise.Group("/payments")
			payments.Use(middleware.RequireAuth())
			{
				payments.POST("/intent", enterpriseHandler.CreatePaymentIntent)
			}
		}

		// AI-powered routes (OpenHands integration)
		ai.RegisterRoutes(v1, cfg)
	}
}
