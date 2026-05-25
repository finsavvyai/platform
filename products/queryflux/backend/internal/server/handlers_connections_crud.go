package server

import (
	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain/entities"
	"go.uber.org/zap"
)

// createConnection handles POST /api/v1/connections.
func (s *Server) createConnection(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	if !exists || userIDVal.(string) == "" {
		s.respondWithUnauthorized(c, "User not authenticated")
		return
	}
	userID := userIDVal.(string)

	var req CreateConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		s.logger.Error("Failed to bind create connection request", zap.Error(err))
		s.respondWithValidationError(c, "request", "Invalid request format: "+err.Error())
		return
	}

	if !s.enforceConnectionQuota(c, userID) {
		return
	}

	connectionService := s.container.GetConnectionService()
	if dup, err := s.connectionNameTaken(c, userID, req.Name); err != nil {
		return
	} else if dup {
		s.respondWithConflict(c, "Connection with this name already exists")
		return
	}

	connection, err := connectionService.Create(
		c.Request.Context(), userID,
		req.Name, req.Type, req.Host, req.Port,
		req.Database, req.Username, req.Password,
	)
	if err != nil {
		s.logger.Error("Failed to create connection", zap.Error(err))
		s.respondWithInternalError(c, "Failed to create connection", err)
		return
	}

	if req.SSL {
		connection.SSL = req.SSL
	}
	if req.Options != nil {
		connection.Options = req.Options
	}
	if err := connectionService.Update(c.Request.Context(), connection); err != nil {
		s.logger.Error("Failed to update connection options", zap.Error(err))
		s.respondWithInternalError(c, "Failed to update connection options", err)
		return
	}

	if subObj, exists := c.Get("subscription"); exists {
		sub := subObj.(*entities.Subscription)
		s.logger.Info("Tracking connection creation usage",
			zap.String("user_id", userID), zap.String("plan", sub.PlanType))
	}

	s.respondWithCreated(c, s.mapConnectionToResponse(connection))
}

// updateConnection handles PUT /api/v1/connections/:id.
func (s *Server) updateConnection(c *gin.Context) {
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

	var req UpdateConnectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		s.logger.Error("Failed to bind update connection request", zap.Error(err))
		s.respondWithValidationError(c, "request", "Invalid request format: "+err.Error())
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

	applyConnectionUpdates(connection, &req)

	if err := connectionService.Update(c.Request.Context(), connection); err != nil {
		s.logger.Error("Failed to update connection", zap.String("id", connectionID), zap.Error(err))
		s.respondWithInternalError(c, "Failed to update connection", err)
		return
	}

	s.respondWithSuccess(c, s.mapConnectionToResponse(connection))
}

// deleteConnection handles DELETE /api/v1/connections/:id.
func (s *Server) deleteConnection(c *gin.Context) {
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

	if err := connectionService.Delete(c.Request.Context(), connectionID); err != nil {
		s.logger.Error("Failed to delete connection", zap.String("id", connectionID), zap.Error(err))
		s.respondWithInternalError(c, "Failed to delete connection", err)
		return
	}

	s.respondWithNoContent(c)
}
