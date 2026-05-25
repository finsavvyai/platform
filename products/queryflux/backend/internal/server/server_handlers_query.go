package server

import (
	"net/http"
	"strconv"

	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/gin-gonic/gin"
)

// Query management handlers (general query listing/history)

func (s *Server) getQueries(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	search := c.Query("search")
	saved := c.DefaultQuery("saved", "false")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}

	offset := (page - 1) * pageSize

	queryService := s.container.GetQueryService()
	var queries []*entities.Query
	var err error

	if search != "" {
		queries, err = queryService.Search(c.Request.Context(), userID, search, pageSize, offset)
	} else if saved == "true" {
		queries, err = queryService.GetSavedQueries(c.Request.Context(), userID, pageSize, offset)
	} else {
		queries, err = queryService.GetUserHistory(c.Request.Context(), userID, pageSize, offset)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "QUERY_FETCH_FAILED",
			"message": "Failed to retrieve queries",
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
	c.JSON(http.StatusOK, response)
}

func (s *Server) getQuery(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	queryID := c.Param("id")
	if queryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Query ID is required",
		})
		return
	}

	queryService := s.container.GetQueryService()
	query, err := queryService.GetByID(c.Request.Context(), queryID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "QUERY_NOT_FOUND",
			"message": "Query not found",
		})
		return
	}

	connectionService := s.container.GetConnectionService()
	connection, err := connectionService.GetByID(c.Request.Context(), query.ConnectionID)
	if err != nil || connection.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "ACCESS_DENIED",
			"message": "Access denied to this query",
		})
		return
	}

	response := s.mapQueryToResponse(query)
	c.JSON(http.StatusOK, response)
}

func (s *Server) deleteQuery(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	queryID := c.Param("id")
	if queryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "VALIDATION_ERROR",
			"message": "Query ID is required",
		})
		return
	}

	queryService := s.container.GetQueryService()
	query, err := queryService.GetByID(c.Request.Context(), queryID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "QUERY_NOT_FOUND",
			"message": "Query not found",
		})
		return
	}

	connectionService := s.container.GetConnectionService()
	connection, err := connectionService.GetByID(c.Request.Context(), query.ConnectionID)
	if err != nil || connection.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"error":   "ACCESS_DENIED",
			"message": "Access denied to this query",
		})
		return
	}

	if err := queryService.Delete(c.Request.Context(), queryID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "QUERY_DELETE_FAILED",
			"message": "Failed to delete query",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Query deleted successfully"})
}
