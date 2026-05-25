package server

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func (s *Server) getUserQueryHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}

	offset := (page - 1) * pageSize

	queryService := s.container.GetQueryService()
	queries, err := queryService.GetUserHistory(c.Request.Context(), userID, pageSize, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "QUERY_HISTORY_FAILED",
			"message": "Failed to retrieve query history",
			"details": err.Error(),
		})
		return
	}

	queryResponses := make([]QueryResponse, len(queries))
	for i, query := range queries {
		queryResponses[i] = s.mapQueryToResponse(query)
	}

	response := QueryListResponse{
		Queries:  queryResponses,
		Total:    int64(len(queries)),
		Page:     page,
		PageSize: pageSize,
		HasMore:  len(queries) == pageSize,
	}

	if c.Query("include_stats") == "true" {
		stats, err := queryService.GetExecutionStats(c.Request.Context(), userID, days)
		if err == nil {
			c.JSON(http.StatusOK, gin.H{
				"queries": response,
				"stats":   stats,
			})
			return
		}
	}

	c.JSON(http.StatusOK, response)
}
