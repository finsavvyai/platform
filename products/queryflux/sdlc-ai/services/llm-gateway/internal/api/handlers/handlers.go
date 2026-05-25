//go:build ignore

package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/SDLC/llm-gateway/internal/llm"
	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

// Handler handles HTTP requests
type Handler struct {
	gateway *llm.Gateway
	logger  *logrus.Logger
}

// NewHandler creates a new handler
func NewHandler(gateway *llm.Gateway, logger *logrus.Logger) *Handler {
	return &Handler{
		gateway: gateway,
		logger:  logger,
	}
}

// Complete handles completion requests
func (h *Handler) Complete(c *gin.Context) {
	var req models.CompletionRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request format",
			"details": err.Error(),
		})
		return
	}

	// Add user/tenant info from context
	if userID, exists := c.Get("user_id"); exists {
		req.UserID = userID.(string)
	}
	if tenantID, exists := c.Get("tenant_id"); exists {
		req.TenantID = tenantID.(string)
	}

	// Add request metadata
	if req.Metadata == nil {
		req.Metadata = make(map[string]string)
	}
	req.Metadata["request_id"] = c.GetHeader("X-Request-ID")
	req.Metadata["ip_address"] = c.ClientIP()
	req.Metadata["user_agent"] = c.GetHeader("User-Agent")

	// Process request
	response, err := h.gateway.Complete(c.Request.Context(), &req)
	if err != nil {
		h.logger.WithFields(logrus.Fields{
			"error":     err.Error(),
			"user_id":   req.UserID,
			"tenant_id": req.TenantID,
		}).Error("Completion failed")

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Completion failed",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

// CompleteStream handles streaming completion requests
func (h *Handler) CompleteStream(c *gin.Context) {
	var req models.CompletionRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request format",
			"details": err.Error(),
		})
		return
	}

	// Set stream to true
	req.Stream = true

	// Add user/tenant info from context
	if userID, exists := c.Get("user_id"); exists {
		req.UserID = userID.(string)
	}
	if tenantID, exists := c.Get("tenant_id"); exists {
		req.TenantID = tenantID.(string)
	}

	// Create stream
	stream, err := h.gateway.CompleteStream(c.Request.Context(), &req)
	if err != nil {
		h.logger.WithError(err).Error("Stream creation failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Stream creation failed",
			"details": err.Error(),
		})
		return
	}

	// Set streaming headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")

	// Send events
	for chunk := range stream {
		if chunk.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Stream error",
				"details": chunk.Error.Error(),
			})
			return
		}

		if chunk.Done {
			c.SSEvent("done", gin.H{})
			return
		}

		c.SSEvent("chunk", chunk)
		c.Writer.Flush()
	}
}

// Models handles requests for available models
func (h *Handler) Models(c *gin.Context) {
	models, err := h.gateway.GetAvailableModels(c.Request.Context())
	if err != nil {
		h.logger.WithError(err).Error("Failed to get models")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to retrieve models",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"models": models,
		"count":  len(models),
	})
}

// Health handles health check requests
func (h *Handler) Health(c *gin.Context) {
	health := h.gateway.GetProviderHealth(c.Request.Context())

	status := http.StatusOK
	for _, providerHealth := range health {
		if providerHealth.Status == "unhealthy" {
			status = http.StatusServiceUnavailable
			break
		}
	}

	c.JSON(status, gin.H{
		"status":    status,
		"timestamp": time.Now().UTC(),
		"providers": health,
	})
}

// Providers handles requests for provider information
func (h *Handler) Providers(c *gin.Context) {
	providers := h.gateway.ListProviders()

	result := make(map[string]interface{})
	for name, provider := range providers {
		modelInfo, _ := provider.GetModelInfo()
		result[name] = gin.H{
			"name":    provider.GetName(),
			"enabled": provider.IsEnabled(),
			"models":  modelInfo,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"providers": result,
	})
}

// EnableProvider handles requests to enable a provider
func (h *Handler) EnableProvider(c *gin.Context) {
	providerName := c.Param("provider")

	if providerName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provider name is required",
		})
		return
	}

	err := h.gateway.EnableProvider(providerName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Provider not found",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Provider enabled successfully",
		"provider": providerName,
	})
}

// DisableProvider handles requests to disable a provider
func (h *Handler) DisableProvider(c *gin.Context) {
	providerName := c.Param("provider")

	if providerName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Provider name is required",
		})
		return
	}

	err := h.gateway.DisableProvider(providerName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Provider not found",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "Provider disabled successfully",
		"provider": providerName,
	})
}

// GetCostHistory handles requests for cost history
func (h *Handler) GetCostHistory(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	userID := c.Query("user_id")

	if tenantID == "" {
		if tID, exists := c.Get("tenant_id"); exists {
			tenantID = tID.(string)
		}
	}

	// Parse time range
	startTimeStr := c.DefaultQuery("start_time", "")
	endTimeStr := c.DefaultQuery("end_time", "")

	var startTime, endTime time.Time
	var err error

	if startTimeStr != "" {
		startTime, err = time.Parse(time.RFC3339, startTimeStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid start_time format",
				"details": "Use RFC3339 format",
			})
			return
		}
	} else {
		startTime = time.Now().AddDate(0, -1, 0) // Default to 1 month ago
	}

	if endTimeStr != "" {
		endTime, err = time.Parse(time.RFC3339, endTimeStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Invalid end_time format",
				"details": "Use RFC3339 format",
			})
			return
		}
	} else {
		endTime = time.Now()
	}

	// Parse limit
	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 100
	}

	// Get cost history (this would need to be implemented in the gateway)
	c.JSON(http.StatusOK, gin.H{
		"message":    "Cost history endpoint not yet implemented",
		"tenant_id":  tenantID,
		"user_id":    userID,
		"start_time": startTime,
		"end_time":   endTime,
		"limit":      limit,
	})
}

// GetUsageStats handles requests for usage statistics
func (h *Handler) GetUsageStats(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	userID := c.Query("user_id")
	period := c.DefaultQuery("period", "monthly")

	if tenantID == "" {
		if tID, exists := c.Get("tenant_id"); exists {
			tenantID = tID.(string)
		}
	}

	// Get usage stats (this would need to be implemented in the gateway)
	c.JSON(http.StatusOK, gin.H{
		"message":   "Usage stats endpoint not yet implemented",
		"tenant_id": tenantID,
		"user_id":   userID,
		"period":    period,
	})
}

// ValidateRequest handles validation requests
func (h *Handler) ValidateRequest(c *gin.Context) {
	var req struct {
		Model       string           `json:"model"`
		Messages    []models.Message `json:"messages"`
		MaxTokens   int              `json:"max_tokens"`
		Temperature float64          `json:"temperature"`
		TopP        float64          `json:"top_p"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request format",
			"details": err.Error(),
		})
		return
	}

	// Create completion request for validation
	completionReq := &models.CompletionRequest{
		Model:       req.Model,
		Messages:    req.Messages,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
	}

	// Get validator (this would need to be accessible through the gateway)
	c.JSON(http.StatusOK, gin.H{
		"message": "Validation endpoint not yet implemented",
		"valid":   true,
		"errors":  []string{},
	})
}
