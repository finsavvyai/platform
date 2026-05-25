package routes

import (
	"net/http"

	"github.com/SDLC/llm-gateway/internal/api/handlers"
	"github.com/SDLC/llm-gateway/internal/middleware"
	"github.com/SDLC/llm-gateway/internal/monitoring"
	"github.com/gin-gonic/gin"
)

// Setup configures all API routes using the shared Handler.
func Setup(router *gin.Engine, h *handlers.Handler) {
	// API version 1
	v1 := router.Group("/api/v1")
	{
		public := v1.Group("/")
		{
			public.GET("/health", h.Health)
			public.GET("/models", h.Models)
			public.GET("/providers/status", h.Providers)
		}

		protected := v1.Group("/")
		protected.Use(middleware.Authentication())
		protected.Use(middleware.RateLimiting())
		{
			llm := protected.Group("/llm")
			{
				llm.POST("/complete", h.Complete)
				llm.POST("/stream", h.CompleteStream)
				llm.POST("/validate", h.ValidateRequest)
			}

			usage := protected.Group("/usage")
			{
				usage.GET("/stats", h.GetUsageStats)
				usage.GET("/cost", h.GetCostHistory)
			}

			metrics := protected.Group("/metrics")
			{
				metrics.GET("/", h.GetUsageStats)
				metrics.GET("/tokens", h.GetUsageStats)
				metrics.GET("/cost", h.GetCostHistory)
			}

			limits := protected.Group("/limits")
			{
				limits.GET("/", h.GetUsageStats)
				limits.GET("/quota", h.GetUsageStats)
			}
		}
	}

	admin := router.Group("/admin")
	admin.Use(middleware.AdminAuth())
	{
		admin.GET("/health/detailed", h.Health)
		admin.GET("/providers", h.Providers)
		admin.GET("/usage/all", h.GetUsageStats)
		admin.GET("/cost/all", h.GetCostHistory)
		admin.GET("/metrics/global", h.GetUsageStats)
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
