package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

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
