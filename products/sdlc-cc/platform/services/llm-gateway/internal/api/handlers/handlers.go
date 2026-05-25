package handlers

import (
	"net/http"

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
