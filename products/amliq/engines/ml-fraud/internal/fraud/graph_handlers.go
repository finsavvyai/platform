package fraud

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// GraphHandler handles fraud network graph HTTP requests.
type GraphHandler struct {
	repo GraphRepository
}

// NewGraphHandler creates a new graph handler.
func NewGraphHandler(repo GraphRepository) *GraphHandler {
	return &GraphHandler{repo: repo}
}

// QueryGraph handles GET /v1/fraud-rings/graph -- returns paginated graph data.
func (h *GraphHandler) QueryGraph(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		h.sendGraphError(c, http.StatusBadRequest, "MISSING_TENANT",
			"tenant_id query parameter is required", nil, requestID)
		return
	}

	req := &GraphQueryRequest{
		TenantID: tenantID,
		Filters:  parseGraphFilters(c),
	}

	if offset, limit, ok := parsePagination(c); ok {
		req.Pagination = &GraphPagination{Offset: offset, Limit: limit}
	}

	resp, err := h.repo.QueryGraph(req)
	if err != nil {
		h.sendGraphError(c, http.StatusBadRequest, "QUERY_ERROR",
			err.Error(), nil, requestID)
		return
	}

	resp.RequestID = requestID
	resp.Timestamp = time.Now()
	c.JSON(http.StatusOK, resp)
}

// GetGraphStats handles GET /v1/fraud-rings/graph/stats.
func (h *GraphHandler) GetGraphStats(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		h.sendGraphError(c, http.StatusBadRequest, "MISSING_TENANT",
			"tenant_id query parameter is required", nil, requestID)
		return
	}

	stats, err := h.repo.GetGraphStatistics(tenantID)
	if err != nil {
		h.sendGraphError(c, http.StatusInternalServerError, "STATS_ERROR",
			err.Error(), nil, requestID)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"stats":      stats,
		"request_id": requestID,
		"timestamp":  time.Now(),
	})
}

// GetNodeDetail handles GET /v1/fraud-rings/graph/nodes/:id.
func (h *GraphHandler) GetNodeDetail(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	tenantID := c.Query("tenant_id")
	nodeID := c.Param("id")

	if tenantID == "" {
		h.sendGraphError(c, http.StatusBadRequest, "MISSING_TENANT",
			"tenant_id query parameter is required", nil, requestID)
		return
	}
	if nodeID == "" {
		h.sendGraphError(c, http.StatusBadRequest, "MISSING_NODE_ID",
			"node id path parameter is required", nil, requestID)
		return
	}

	node, err := h.repo.GetNodeDetail(tenantID, nodeID)
	if err != nil {
		h.sendGraphError(c, http.StatusNotFound, "NODE_NOT_FOUND",
			err.Error(), nil, requestID)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"node":       node,
		"request_id": requestID,
		"timestamp":  time.Now(),
	})
}

// GetCommunityDetail handles GET /v1/fraud-rings/graph/communities/:id.
func (h *GraphHandler) GetCommunityDetail(c *gin.Context) {
	requestID := generateRequestID()
	c.Header("X-Request-ID", requestID)

	tenantID := c.Query("tenant_id")
	communityID := c.Param("id")

	if tenantID == "" {
		h.sendGraphError(c, http.StatusBadRequest, "MISSING_TENANT",
			"tenant_id query parameter is required", nil, requestID)
		return
	}
	if communityID == "" {
		h.sendGraphError(c, http.StatusBadRequest, "MISSING_COMMUNITY_ID",
			"community id path parameter is required", nil, requestID)
		return
	}

	community, err := h.repo.GetCommunityDetail(tenantID, communityID)
	if err != nil {
		h.sendGraphError(c, http.StatusNotFound, "COMMUNITY_NOT_FOUND",
			err.Error(), nil, requestID)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"community":  community,
		"request_id": requestID,
		"timestamp":  time.Now(),
	})
}

func parseGraphFilters(c *gin.Context) *GraphFilters {
	filters := &GraphFilters{}
	if nt := c.Query("node_type"); nt != "" {
		filters.NodeTypes = []string{nt}
	}
	if minRS := c.Query("min_risk_score"); minRS != "" {
		if v, err := strconv.ParseFloat(minRS, 64); err == nil {
			filters.MinRiskScore = v
		}
	}
	if maxRS := c.Query("max_risk_score"); maxRS != "" {
		if v, err := strconv.ParseFloat(maxRS, 64); err == nil {
			filters.MaxRiskScore = v
		}
	}
	return filters
}

func parsePagination(c *gin.Context) (int, int, bool) {
	offsetStr := c.Query("offset")
	limitStr := c.Query("limit")
	if offsetStr == "" && limitStr == "" {
		return 0, 0, false
	}
	offset, _ := strconv.Atoi(offsetStr)
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	return offset, limit, true
}

func (h *GraphHandler) sendGraphError(c *gin.Context, status int, code, msg string, details map[string]interface{}, reqID string) {
	c.JSON(status, &ErrorResponse{
		ErrorCode: code, Message: msg, Details: details,
		Timestamp: time.Now(), RequestID: reqID,
	})
}
