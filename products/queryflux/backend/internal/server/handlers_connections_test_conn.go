package server

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// testConnection handles POST /api/v1/connections/:id/test.
//
// Phase-1 wiring (FIX-E): probes the live database by resolving a real
// driver-backed adapter via the canonical factory and calling its
// HealthCheck method. Replaces the legacy stub which always returned
// success after a fixed sleep.
//
// Errors are logged with conn.RedactedDSN (never the raw DSN) and
// surfaced to the client via SafeErrorMessage so driver text never leaks.
// See SECURITY_REVIEW.md HIGH-5.
func (s *Server) testConnection(c *gin.Context) {
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

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	startTime := time.Now()
	adapter, err := s.resolveAdapter(ctx, connection)
	latency := time.Since(startTime).Milliseconds()

	if err != nil {
		s.logger.Warn("Connection test failed at resolveAdapter",
			zap.String("id", connectionID),
			zap.String("redacted_dsn", connection.RedactedDSN()),
			zap.Error(err))
		s.respondWithError(c, MapAdapterErrorToHTTP(err),
			errCodeForStatus(MapAdapterErrorToHTTP(err)),
			SafeErrorMessage(err),
			map[string]interface{}{"latency_ms": latency})
		return
	}
	defer func() { _ = adapter.Disconnect(ctx) }()

	if err := adapter.HealthCheck(ctx); err != nil {
		s.logger.Warn("Connection test failed at HealthCheck",
			zap.String("id", connectionID),
			zap.String("redacted_dsn", connection.RedactedDSN()),
			zap.Error(err))
		s.respondWithError(c, MapAdapterErrorToHTTP(err),
			errCodeForStatus(MapAdapterErrorToHTTP(err)),
			SafeErrorMessage(err),
			map[string]interface{}{"latency_ms": time.Since(startTime).Milliseconds()})
		return
	}

	if err := connectionService.UpdateStatus(c.Request.Context(), connectionID, "active"); err != nil {
		s.logger.Warn("Failed to update connection status", zap.String("id", connectionID), zap.Error(err))
	}
	if err := connectionService.MarkAsUsed(c.Request.Context(), connectionID); err != nil {
		s.logger.Warn("Failed to mark connection as used", zap.String("id", connectionID), zap.Error(err))
	}

	s.respondWithSuccess(c, TestConnectionResponse{
		Success:    true,
		Message:    "Connection successful",
		Latency:    time.Since(startTime).Milliseconds(),
		ServerInfo: "Connected successfully",
	})
}
