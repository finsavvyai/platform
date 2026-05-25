package http

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/queryflux/backend/internal/application/ports"
	"github.com/queryflux/backend/internal/domain"
	"go.uber.org/zap"
)

// HandleWebSocket handles WebSocket connections for real-time monitoring
func (h *MonitoringHandlers) HandleWebSocket(c *gin.Context) {
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error("Failed to upgrade WebSocket connection", zap.Error(err))
		return
	}
	defer conn.Close()

	clientID := generateClientID()
	h.logger.Info("WebSocket client connected", zap.String("client_id", clientID))

	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil {
			h.logger.Debug("WebSocket connection closed", zap.Error(err), zap.String("client_id", clientID))
			break
		}

		h.handleWebSocketMessage(c.Request.Context(), conn, clientID, msg)
	}
}

func (h *MonitoringHandlers) handleWebSocketMessage(ctx context.Context, conn *websocket.Conn, clientID string, msg map[string]interface{}) {
	msgType, ok := msg["type"].(string)
	if !ok {
		h.sendWebSocketError(conn, "Message type is required")
		return
	}

	switch msgType {
	case "subscribe":
		h.handleWebSocketSubscribe(ctx, conn, clientID, msg)
	case "unsubscribe":
		h.handleWebSocketUnsubscribe(ctx, conn, clientID, msg)
	case "ping":
		h.sendWebSocketPong(conn)
	default:
		h.sendWebSocketError(conn, fmt.Sprintf("Unknown message type: %s", msgType))
	}
}

func (h *MonitoringHandlers) handleWebSocketSubscribe(ctx context.Context, conn *websocket.Conn, clientID string, msg map[string]interface{}) {
	subType, ok := msg["subscription_type"].(string)
	if !ok {
		h.sendWebSocketError(conn, "subscription_type is required")
		return
	}

	switch subType {
	case "metrics":
		h.handleMetricsSubscribe(ctx, conn, clientID, msg)
	case "alerts":
		h.handleAlertsSubscribe(ctx, conn, clientID, msg)
	default:
		h.sendWebSocketError(conn, fmt.Sprintf("Unknown subscription type: %s", subType))
	}
}

func (h *MonitoringHandlers) handleMetricsSubscribe(ctx context.Context, conn *websocket.Conn, clientID string, msg map[string]interface{}) {
	var subscription ports.MetricsSubscription
	subscription.ID = generateSubscriptionID()
	subscription.ClientID = clientID
	subscription.Interval = 5 * time.Second

	if filters, ok := msg["filters"].(map[string]interface{}); ok {
		if names, ok := filters["names"].([]interface{}); ok {
			for _, name := range names {
				if nameStr, ok := name.(string); ok {
					subscription.Filters.Names = append(subscription.Filters.Names, nameStr)
				}
			}
		}
		if labels, ok := filters["labels"].(map[string]interface{}); ok {
			subscription.Filters.Labels = make(map[string]string)
			for k, v := range labels {
				if vStr, ok := v.(string); ok {
					subscription.Filters.Labels[k] = vStr
				}
			}
		}
	}

	if h.wsManager != nil {
		if err := h.wsManager.SubscribeToMetrics(ctx, &subscription); err != nil {
			h.sendWebSocketError(conn, fmt.Sprintf("Failed to subscribe: %v", err))
			return
		}
	}

	h.sendWebSocketResponse(conn, "subscription_confirmed", gin.H{
		"subscription_id": subscription.ID,
		"type":            "metrics",
	})
}

func (h *MonitoringHandlers) handleAlertsSubscribe(ctx context.Context, conn *websocket.Conn, clientID string, msg map[string]interface{}) {
	var subscription ports.AlertsSubscription
	subscription.ID = generateSubscriptionID()
	subscription.ClientID = clientID

	if filters, ok := msg["filters"].(map[string]interface{}); ok {
		if severities, ok := filters["severity"].([]interface{}); ok {
			for _, severity := range severities {
				if severityStr, ok := severity.(string); ok {
					subscription.Filters.Severity = append(subscription.Filters.Severity, domain.AlertSeverity(severityStr))
				}
			}
		}
		if statuses, ok := filters["status"].([]interface{}); ok {
			for _, status := range statuses {
				if statusStr, ok := status.(string); ok {
					subscription.Filters.Status = append(subscription.Filters.Status, domain.AlertStatus(statusStr))
				}
			}
		}
	}

	if h.wsManager != nil {
		if err := h.wsManager.SubscribeToAlerts(ctx, &subscription); err != nil {
			h.sendWebSocketError(conn, fmt.Sprintf("Failed to subscribe: %v", err))
			return
		}
	}

	h.sendWebSocketResponse(conn, "subscription_confirmed", gin.H{
		"subscription_id": subscription.ID,
		"type":            "alerts",
	})
}

func (h *MonitoringHandlers) handleWebSocketUnsubscribe(ctx context.Context, conn *websocket.Conn, clientID string, msg map[string]interface{}) {
	subscriptionID, ok := msg["subscription_id"].(string)
	if !ok {
		h.sendWebSocketError(conn, "subscription_id is required")
		return
	}

	if h.wsManager != nil {
		if strings.HasPrefix(subscriptionID, "metrics_") {
			h.wsManager.UnsubscribeFromMetrics(ctx, subscriptionID)
		} else if strings.HasPrefix(subscriptionID, "alerts_") {
			h.wsManager.UnsubscribeFromAlerts(ctx, subscriptionID)
		}
	}

	h.sendWebSocketResponse(conn, "unsubscription_confirmed", gin.H{
		"subscription_id": subscriptionID,
	})
}

func (h *MonitoringHandlers) sendWebSocketResponse(conn *websocket.Conn, msgType string, data interface{}) {
	response := gin.H{
		"type":      msgType,
		"data":      data,
		"timestamp": time.Now(),
	}

	if err := conn.WriteJSON(response); err != nil {
		h.logger.Error("Failed to send WebSocket response", zap.Error(err))
	}
}

func (h *MonitoringHandlers) sendWebSocketError(conn *websocket.Conn, message string) {
	h.sendWebSocketResponse(conn, "error", gin.H{"message": message})
}

func (h *MonitoringHandlers) sendWebSocketPong(conn *websocket.Conn) {
	h.sendWebSocketResponse(conn, "pong", gin.H{"timestamp": time.Now()})
}

func generateClientID() string {
	return fmt.Sprintf("client_%d", time.Now().UnixNano())
}

func generateSubscriptionID() string {
	return fmt.Sprintf("sub_%d", time.Now().UnixNano())
}
