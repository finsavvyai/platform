package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain/entities"
	"go.uber.org/zap"
)

// enforceConnectionQuota returns false (and writes the HTTP response) when the
// caller has reached their subscription's connection limit.
func (s *Server) enforceConnectionQuota(c *gin.Context, userID string) bool {
	current, err := s.container.ConnectionRepository.Count(c.Request.Context(), userID)
	if err != nil {
		s.logger.Error("Failed to count connections", zap.Error(err))
		s.respondWithInternalError(c, "Failed to check limits", err)
		return false
	}
	subObj, exists := c.Get("subscription")
	if !exists {
		return true
	}
	sub := subObj.(*entities.Subscription)
	maxConn := s.getMaxConnectionsForPlan(sub.PlanType)
	if maxConn > 0 && current >= int64(maxConn) {
		s.respondWithError(c, http.StatusForbidden, "CONNECTION_LIMIT_REACHED",
			"You have reached the maximum number of connections for your plan",
			map[string]interface{}{
				"current":     current,
				"limit":       maxConn,
				"upgrade_url": "/api/v1/subscriptions/plans",
			})
		return false
	}
	return true
}

// connectionNameTaken reports whether userID already owns a connection named
// name. It writes an internal-error response and returns (false, err) on
// repository failures.
func (s *Server) connectionNameTaken(c *gin.Context, userID, name string) (bool, error) {
	existing, err := s.container.GetConnectionService().GetByUserID(c.Request.Context(), userID, 1, 0)
	if err != nil {
		s.logger.Error("Failed to check existing connections", zap.Error(err))
		s.respondWithInternalError(c, "Failed to check existing connections", err)
		return false, err
	}
	for _, conn := range existing {
		if conn.Name == name {
			return true, nil
		}
	}
	return false, nil
}

// applyConnectionUpdates copies non-nil fields from req onto connection.
func applyConnectionUpdates(connection *entities.Connection, req *UpdateConnectionRequest) {
	if req.Name != nil {
		connection.Name = *req.Name
	}
	if req.Host != nil {
		connection.Host = *req.Host
	}
	if req.Port != nil {
		connection.Port = *req.Port
	}
	if req.Database != nil {
		connection.Database = *req.Database
	}
	if req.Username != nil {
		connection.Username = *req.Username
	}
	if req.Password != nil {
		connection.Password = *req.Password
	}
	if req.SSL != nil {
		connection.SSL = *req.SSL
	}
	if req.Options != nil {
		connection.Options = req.Options
	}
}
