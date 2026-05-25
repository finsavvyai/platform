package fraud

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"quantumbeam/internal/interfaces"
)

// RegisterRoutes registers fraud detection routes
func RegisterRoutes(router *gin.RouterGroup, fraudService interfaces.FraudDetectionService, intelligentRouter interfaces.IntelligentRouter) {
	handler := NewHandler(fraudService, intelligentRouter)

	// Transaction analysis endpoints
	mutating := router.Group("")
	mutating.Use(RequestIDMiddleware())
	mutating.Use(RateLimitMiddleware(120))
	mutating.Use(JSONContentTypeAndBodyLimitMiddleware(1 << 20)) // 1 MiB
	mutating.POST("/analyze", handler.AnalyzeTransaction)
	mutating.POST("/analyze/batch", handler.AnalyzeBatch)
	mutating.POST("/fraud-rings/detect", handler.DetectFraudRings)

	// Performance and status endpoints
	readOnly := router.Group("")
	readOnly.Use(RequestIDMiddleware())
	readOnly.Use(RateLimitMiddleware(240))
	readOnly.GET("/performance", handler.GetPerformanceMetrics)
	readOnly.GET("/backends/status", handler.GetBackendStatus)
	readOnly.GET("/routing/decision", handler.GetRoutingDecision)
}

// GetPerformanceMetrics handles GET /v1/performance for quantum performance metrics
func (h *Handler) GetPerformanceMetrics(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	ctx := c.Request.Context()

	metrics, err := h.fraudService.GetQuantumPerformance(ctx)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, "PERFORMANCE_ERROR", "Failed to get performance metrics",
			map[string]interface{}{"error": err.Error()}, requestID)
		return
	}

	response := map[string]interface{}{
		"metrics":    metrics,
		"request_id": requestID,
		"timestamp":  time.Now(),
	}

	c.JSON(http.StatusOK, response)
}

// GetBackendStatus handles GET /v1/backends/status for quantum backend status
func (h *Handler) GetBackendStatus(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	ctx := c.Request.Context()

	status, err := h.fraudService.GetQuantumBackendStatus(ctx)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, "BACKEND_ERROR", "Failed to get backend status",
			map[string]interface{}{"error": err.Error()}, requestID)
		return
	}

	response := map[string]interface{}{
		"status":     status,
		"request_id": requestID,
		"timestamp":  time.Now(),
	}

	c.JSON(http.StatusOK, response)
}

// GetRoutingDecision handles GET /v1/routing/decision for routing decision information
func (h *Handler) GetRoutingDecision(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	// Parse query parameters for features
	features := make(map[string]float64)

	// Example feature parameters
	if amount := c.Query("amount"); amount != "" {
		if val, err := strconv.ParseFloat(amount, 64); err == nil {
			features["amount"] = val
		}
	}

	if riskScore := c.Query("risk_score"); riskScore != "" {
		if val, err := strconv.ParseFloat(riskScore, 64); err == nil {
			features["risk_score"] = val
		}
	}

	ctx := c.Request.Context()

	decision, err := h.router.GetRoutingDecision(ctx, features)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, "ROUTING_ERROR", "Failed to get routing decision",
			map[string]interface{}{"error": err.Error()}, requestID)
		return
	}

	response := map[string]interface{}{
		"decision":   decision,
		"features":   features,
		"request_id": requestID,
		"timestamp":  time.Now(),
	}

	c.JSON(http.StatusOK, response)
}
