//go:build ignore

package routes

import (
	"net/http"

	"github.com/SDLC/llm-gateway/internal/api/handlers"
	"github.com/SDLC/llm-gateway/internal/middleware"
	"github.com/SDLC/llm-gateway/internal/monitoring"
	"github.com/gin-gonic/gin"
)

// Setup configures all API routes
func Setup(router *gin.Engine, handlers *handlers.Handlers) {
	// API version 1
	v1 := router.Group("/api/v1")
	{
		// Public endpoints
		public := v1.Group("/")
		{
			public.GET("/health", handlers.Health)
			public.GET("/models", handlers.ListModels)
			public.GET("/providers/status", handlers.GetProviderStatus)
		}

		// Authenticated endpoints
		protected := v1.Group("/")
		protected.Use(middleware.Authentication())
		protected.Use(middleware.RateLimiting())
		{
			// LLM endpoints
			llm := protected.Group("/llm")
			{
				llm.POST("/complete", handlers.Complete)
				llm.POST("/stream", handlers.StreamComplete)
				llm.POST("/validate", handlers.Validate)
			}

			// Usage and cost endpoints
			usage := protected.Group("/usage")
			{
				usage.GET("/stats", handlers.GetUsage)
				usage.GET("/cost", handlers.GetCost)
			}

			// Metrics endpoints
			metrics := protected.Group("/metrics")
			{
				metrics.GET("/", handlers.GetMetrics)
				metrics.GET("/tokens", handlers.GetMetrics)
				metrics.GET("/cost", handlers.GetMetrics)
			}

			// Rate limit and quota endpoints
			limits := protected.Group("/limits")
			{
				limits.GET("/", handlers.GetLimits)
				limits.GET("/quota", handlers.GetLimits)
			}
		}
	}

	// Admin endpoints
	admin := router.Group("/admin")
	admin.Use(middleware.AdminAuth())
	{
		admin.GET("/health/detailed", handlers.Health)
		admin.GET("/providers", handlers.GetProviderStatus)
		admin.GET("/usage/all", handlers.GetUsage)
		admin.GET("/cost/all", handlers.GetCost)
		admin.GET("/metrics/global", handlers.GetMetrics)
	}

	// Prometheus metrics endpoint
	router.GET("/metrics", gin.WrapH(monitoring.GetMetrics()))

	// Swagger documentation
	router.Static("/swagger", "./swagger")
	router.GET("/swagger/*any", gin.WrapH(http.StripPrefix("/swagger/", http.FileServer(http.Dir("./swagger")))))

	// Root endpoint
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "LLM Gateway",
			"version": "1.0.0",
			"status":  "running",
			"endpoints": gin.H{
				"health":        "/api/v1/health",
				"models":        "/api/v1/models",
				"complete":      "/api/v1/llm/complete",
				"stream":        "/api/v1/llm/stream",
				"usage":         "/api/v1/usage/stats",
				"cost":          "/api/v1/usage/cost",
				"metrics":       "/api/v1/metrics",
				"limits":        "/api/v1/limits",
				"providers":     "/api/v1/providers/status",
				"documentation": "/swagger/index.html",
				"prometheus":    "/metrics",
			},
		})
	})

	// 404 handler
	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Endpoint not found",
			"path":  c.Request.URL.Path,
		})
	})
}
