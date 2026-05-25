package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/gin-gonic/gin"
)

// GetCostHistory handles requests for cost history
func (h *Handler) GetCostHistory(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	userID := c.Query("user_id")

	if tenantID == "" {
		if tID, exists := c.Get("tenant_id"); exists {
			tenantID = tID.(string)
		}
	}

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
		startTime = time.Now().AddDate(0, -1, 0)
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

	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 100
	}

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

	if tenantID == "" {
		if tID, exists := c.Get("tenant_id"); exists {
			tenantID = tID.(string)
		}
	}
	if userID == "" {
		if uID, exists := c.Get("user_id"); exists {
			userID = uID.(string)
		}
	}

	stats, err := h.gateway.GetUsageStats(c.Request.Context(), tenantID, userID)
	if err != nil {
		h.logger.WithError(err).WithField("tenant_id", tenantID).WithField("user_id", userID).Warn("GetUsageStats failed")
		c.JSON(http.StatusOK, gin.H{
			"tenant_id":      tenantID,
			"user_id":        userID,
			"daily_spend":    0,
			"monthly_spend":  0,
			"daily_tokens":   0,
			"monthly_tokens": 0,
			"requests_count": 0,
			"message":        "Usage tracking unavailable or no data yet",
		})
		return
	}

	c.JSON(http.StatusOK, stats)
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

	c.JSON(http.StatusOK, gin.H{
		"message": "Validation endpoint not yet implemented",
		"valid":   true,
		"errors":  []string{},
	})
}
