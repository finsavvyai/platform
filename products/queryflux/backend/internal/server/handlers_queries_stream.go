package server

import (
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// handleQueryWebSocket upgrades the HTTP connection and dispatches WS frames.
//
// Phase-1 (FIX-E): execute_query frames are wired into SafeQueryRunner.Stream
// via handleWebSocketQueryExecution; cancel_query stays a TODO for the
// runner-cancel registry (phase-2).
func (s *Server) handleQueryWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logrus.WithError(err).Error("Failed to upgrade WebSocket connection")
		return
	}
	defer conn.Close()

	// TODO: Implement WebSocket authentication
	logrus.Info("WebSocket connection established")

	for {
		var message map[string]interface{}
		if err := conn.ReadJSON(&message); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logrus.WithError(err).Error("WebSocket error")
			}
			break
		}

		messageType, ok := message["type"].(string)
		if !ok {
			_ = conn.WriteJSON(map[string]interface{}{
				"type":  "error",
				"error": "Invalid message format",
			})
			continue
		}

		switch messageType {
		case "execute_query":
			s.handleWebSocketQueryExecution(c, conn, message)
		case "cancel_query":
			s.handleWebSocketQueryCancellation(conn, message)
		case "ping":
			_ = conn.WriteJSON(map[string]interface{}{"type": "pong"})
		default:
			_ = conn.WriteJSON(map[string]interface{}{
				"type":  "error",
				"error": "Unknown message type",
			})
		}
	}
}

// handleWebSocketQueryCancellation handles query cancellation via WebSocket.
//
// TODO(phase-2): hook into runner cancellation via ctx.CancelFunc registry.
// Today this acknowledges the frame so the client UI can release its
// in-flight indicator; the runner-side execution continues until its own
// timeout. Not exploitable, but observably wrong on cancel-and-restart.
func (s *Server) handleWebSocketQueryCancellation(conn *websocket.Conn, message map[string]interface{}) {
	queryID, ok := message["query_id"].(string)
	if !ok {
		_ = conn.WriteJSON(map[string]interface{}{
			"type":  "error",
			"error": "Missing query_id",
		})
		return
	}

	logrus.WithField("query_id", queryID).Info("Query cancellation requested")

	_ = conn.WriteJSON(map[string]interface{}{
		"type":     "cancelled",
		"message":  "Query cancellation requested",
		"query_id": queryID,
	})
}
