package server

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// getConnections handles GET /api/v1/connections.
func (s *Server) getConnections(c *gin.Context) {
	userId, exists := c.Get("user_id")
	if !exists || userId.(string) == "" {
		s.respondWithUnauthorized(c, "User not authenticated")
		return
	}
	userID := userId.(string)

	page, pageSize := parseConnectionsPagination(c)
	offset := (page - 1) * pageSize

	connectionService := s.container.GetConnectionService()
	connections, err := connectionService.GetByUserID(c.Request.Context(), userID, pageSize, offset)
	if err != nil {
		s.logger.Error("Failed to get connections", zap.Error(err))
		s.respondWithInternalError(c, "Failed to retrieve connections", err)
		return
	}

	total, err := s.container.ConnectionRepository.Count(c.Request.Context(), userID)
	if err != nil {
		s.logger.Warn("Failed to count connections for pagination", zap.Error(err))
		total = int64(len(connections))
	}

	connectionResponses := make([]ConnectionResponse, len(connections))
	for i, conn := range connections {
		connectionResponses[i] = s.mapConnectionToResponse(conn)
	}

	response := ConnectionListResponse{
		Connections: connectionResponses,
		Total:       total,
		Page:        page,
		PageSize:    pageSize,
		HasMore:     int64(offset+len(connections)) < total,
	}

	s.respondWithSuccess(c, response)
}

// getConnection handles GET /api/v1/connections/:id.
func (s *Server) getConnection(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		s.respondWithUnauthorized(c, "User not authenticated")
		return
	}

	connectionID := c.Param("id")
	if connectionID == "" {
		s.respondWithValidationError(c, "id", "Connection ID is required")
		return
	}

	connectionService := s.container.GetConnectionService()
	connection, err := connectionService.GetByID(c.Request.Context(), connectionID)
	if err != nil {
		s.logger.Error("Failed to get connection", zap.String("id", connectionID), zap.Error(err))
		s.respondWithNotFound(c, "Connection")
		return
	}

	if connection.UserID != userID {
		s.respondWithForbidden(c, "Access denied to this connection")
		return
	}

	response := s.mapConnectionToResponse(connection)
	s.respondWithSuccess(c, response)
}

// parseConnectionsPagination clamps page/pageSize to safe defaults.
func parseConnectionsPagination(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}
