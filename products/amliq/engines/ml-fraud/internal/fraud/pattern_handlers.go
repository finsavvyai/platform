package fraud

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// PatternHandler handles pattern sharing HTTP requests.
type PatternHandler struct {
	service PatternSharingService
}

// NewPatternHandler creates a new pattern handler.
func NewPatternHandler(service PatternSharingService) *PatternHandler {
	return &PatternHandler{service: service}
}

// GetAggregatePatterns handles GET /v1/patterns/aggregate.
func (h *PatternHandler) GetAggregatePatterns(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		h.sendPatternError(c, http.StatusBadRequest, "MISSING_TENANT",
			"tenant_id query parameter is required", requestID)
		return
	}

	threshold := 5
	if ts := c.Query("threshold"); ts != "" {
		if v, err := strconv.Atoi(ts); err == nil && v >= 3 {
			threshold = v
		}
	}

	patterns, err := h.service.GetAggregatePatterns(tenantID, threshold)
	if err != nil {
		h.sendPatternError(c, http.StatusForbidden, "ACCESS_DENIED", err.Error(), requestID)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"patterns":   patterns,
		"request_id": requestID,
		"timestamp":  time.Now(),
	})
}

// ContributePatterns handles POST /v1/patterns/contribute.
func (h *PatternHandler) ContributePatterns(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	var req PatternContribution
	if err := c.ShouldBindJSON(&req); err != nil {
		h.sendPatternError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error(), requestID)
		return
	}

	if err := h.service.ContributePatterns(&req); err != nil {
		status := http.StatusInternalServerError
		code := "CONTRIBUTION_ERROR"
		if containsSubstring(err.Error(), "not opted in") {
			status = http.StatusForbidden
			code = "NOT_OPTED_IN"
		}
		h.sendPatternError(c, status, code, err.Error(), requestID)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "patterns contributed successfully",
		"request_id": requestID,
		"timestamp":  time.Now(),
	})
}

// GetTenantConfig handles GET /v1/patterns/config.
func (h *PatternHandler) GetTenantConfig(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		h.sendPatternError(c, http.StatusBadRequest, "MISSING_TENANT",
			"tenant_id query parameter is required", requestID)
		return
	}

	config, err := h.service.GetTenantConfig(tenantID)
	if err != nil {
		h.sendPatternError(c, http.StatusInternalServerError, "CONFIG_ERROR", err.Error(), requestID)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"config":     config,
		"request_id": requestID,
		"timestamp":  time.Now(),
	})
}

// UpdateTenantConfig handles PUT /v1/patterns/config.
func (h *PatternHandler) UpdateTenantConfig(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	var config PatternSharingConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		h.sendPatternError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error(), requestID)
		return
	}

	if err := h.service.UpdateTenantConfig(&config); err != nil {
		h.sendPatternError(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error(), requestID)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "configuration updated successfully",
		"request_id": requestID,
		"timestamp":  time.Now(),
	})
}

// GetAggregateStats handles GET /v1/patterns/stats.
func (h *PatternHandler) GetAggregateStats(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	stats, err := h.service.GetAggregateStats()
	if err != nil {
		h.sendPatternError(c, http.StatusInternalServerError, "STATS_ERROR", err.Error(), requestID)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"stats":      stats,
		"request_id": requestID,
		"timestamp":  time.Now(),
	})
}

func (h *PatternHandler) sendPatternError(c *gin.Context, status int, code, msg, reqID string) {
	c.JSON(status, &ErrorResponse{
		ErrorCode: code, Message: msg,
		Timestamp: time.Now(), RequestID: reqID,
	})
}

func containsSubstring(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && findSubstring(s, substr))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
