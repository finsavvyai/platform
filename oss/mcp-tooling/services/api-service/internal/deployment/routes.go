package deployment

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mcpoverflow/api-service/internal/middleware"
)

// RegisterRoutes registers deployment-related routes
func (s *CloudflareService) RegisterRoutes(router *gin.Engine) {
	// Deployment routes group
	deploymentGroup := router.Group("/api/v1/deployments")
	deploymentGroup.Use(middleware.RequireAuth()) // Require authentication for all deployment routes
	{
		// Individual deployment operations
		deploymentGroup.POST("/deploy", s.DeployWorkerHandler)
		deploymentGroup.PUT("/workers/:connectorId", s.UpdateWorkerHandler)
		deploymentGroup.DELETE("/workers/:connectorId", s.DeleteWorkerHandler)
		deploymentGroup.GET("/workers/:connectorId/status", s.GetWorkerStatusHandler)
		deploymentGroup.GET("/workers/:connectorId/logs", s.GetDeploymentLogsHandler)
		deploymentGroup.POST("/workers/:connectorId/rollback", s.RollbackDeploymentHandler)
		deploymentGroup.POST("/workers/:connectorId/validate", s.ValidateDeploymentHandler)

		// List operations
		deploymentGroup.GET("/list", s.ListDeploymentsHandler)

		// Batch operations
		deploymentGroup.POST("/batch", s.BatchDeployHandler)
	}

	// Worker management routes
	workersGroup := router.Group("/api/v1/workers")
	workersGroup.Use(middleware.RequireAuth())
	{
		workersGroup.POST("/", s.DeployWorkerHandler)
		workersGroup.GET("/:connectorId", s.GetWorkerStatusHandler)
		workersGroup.PUT("/:connectorId", s.UpdateWorkerHandler)
		workersGroup.DELETE("/:connectorId", s.DeleteWorkerHandler)
		workersGroup.GET("/:connectorId/status", s.GetWorkerStatusHandler)
		workersGroup.GET("/:connectorId/logs", s.GetDeploymentLogsHandler)
		workersGroup.POST("/:connectorId/rollback", s.RollbackDeploymentHandler)
		workersGroup.POST("/:connectorId/validate", s.ValidateDeploymentHandler)
	}

	// Deployment monitoring routes
	monitoringGroup := router.Group("/api/v1/monitoring")
	monitoringGroup.Use(middleware.RequireAuth())
	{
		monitoringGroup.GET("/workers/:connectorId/health", s.WorkerHealthCheckHandler)
		monitoringGroup.GET("/workers/:connectorId/metrics", s.WorkerMetricsHandler)
		monitoringGroup.POST("/workers/:connectorId/refresh", s.RefreshWorkerHandler)
	}
}

// WorkerHealthCheckHandler handles worker health check requests
func (s *CloudflareService) WorkerHealthCheckHandler(c *gin.Context) {
	connectorID := c.Param("connectorId")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	status, err := s.GetWorkerStatus(c.Request.Context(), connectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to check worker health",
			"details": err.Error(),
			"code":    "HEALTH_CHECK_FAILED",
		})
		return
	}

	health := map[string]interface{}{
		"healthy":      status.Status == "healthy",
		"status":       status.Status,
		"last_checked": status.LastChecked,
		"worker_id":    status.WorkerID,
		"url":          status.URL,
		"environment":  status.Environment,
	}

	c.JSON(http.StatusOK, health)
}

// WorkerMetricsHandler handles worker metrics requests
func (s *CloudflareService) WorkerMetricsHandler(c *gin.Context) {
	connectorID := c.Param("connectorId")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	// Get time range from query parameters
	timeRange := c.DefaultQuery("time_range", "1h") // 1h, 24h, 7d, 30d

	metrics, err := s.getWorkerMetrics(c.Request.Context(), connectorID, timeRange)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to get worker metrics",
			"details": err.Error(),
			"code":    "METRICS_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, metrics)
}

// getWorkerMetrics retrieves worker performance metrics
func (s *CloudflareService) getWorkerMetrics(ctx context.Context, connectorID, timeRange string) (map[string]interface{}, error) {
	// In a real implementation, this would query:
	// - Cloudflare Analytics for request metrics
	// - Worker logs for error rates
	// - Custom metrics for performance
	// - AgentKit metrics if applicable

	// For now, return mock metrics
	metrics := map[string]interface{}{
		"connector_id": connectorID,
		"time_range":   timeRange,
		"requests": map[string]interface{}{
			"total":        10000,
			"successful":   9850,
			"failed":       150,
			"success_rate": 0.985,
		},
		"response_times": map[string]interface{}{
			"avg": 45.2,
			"p50": 42.1,
			"p95": 89.7,
			"p99": 156.3,
		},
		"errors": map[string]interface{}{
			"rate_4xx": 0.008,
			"rate_5xx": 0.007,
		},
		"cpu": map[string]interface{}{
			"usage_avg": 15.3,
			"usage_max": 45.8,
		},
		"memory": map[string]interface{}{
			"usage_avg": 22.1,
			"usage_max": 67.4,
		},
		"agentkit": map[string]interface{}{
			"registered":    true,
			"last_sync":     "2024-01-15T10:30:00Z",
			"invocations":   1250,
			"conversations": 85,
		},
		"updated_at": "2024-01-15T10:30:00Z",
	}

	return metrics, nil
}

// RefreshWorkerHandler handles worker refresh requests
func (s *CloudflareService) RefreshWorkerHandler(c *gin.Context) {
	connectorID := c.Param("connectorId")
	if connectorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Connector ID is required",
			"code":  "MISSING_CONNECTOR_ID",
		})
		return
	}

	// Perform worker refresh (reload configuration, clear caches, etc.)
	err := s.refreshWorker(c.Request.Context(), connectorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to refresh worker",
			"details": err.Error(),
			"code":    "REFRESH_FAILED",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Worker refreshed successfully",
	})
}

// refreshWorker refreshes a worker's configuration and state
func (s *CloudflareService) refreshWorker(ctx context.Context, connectorID string) error {
	// In a real implementation, this would:
	// 1. Trigger a worker reload via Cloudflare API
	// 2. Clear any cached configurations
	// 3. Re-establish AgentKit connections if applicable
	// 4. Update monitoring endpoints

	// For now, just return nil (success)
	return nil
}
