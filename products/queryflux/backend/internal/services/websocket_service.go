package services

import (
	"context"
	"fmt"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/sirupsen/logrus"
)

// webSocketServiceImpl implements the WebSocketService interface
type webSocketServiceImpl struct {
	hub WebSocketHub
}

// WebSocketHub interface for WebSocket hub operations
type WebSocketHub interface {
	BroadcastMetrics(connectionID string, metrics *entities.DatabaseMetrics)
	BroadcastQueryProgress(queryID string, progress *QueryProgressData)
	BroadcastQueryResult(queryID string, query *entities.Query)
	GetStats() map[string]interface{}
}

// QueryProgressData represents query execution progress
type QueryProgressData struct {
	QueryID      string  `json:"query_id"`
	Status       string  `json:"status"`
	Progress     float64 `json:"progress"`
	Message      string  `json:"message"`
	RowsAffected int     `json:"rows_affected,omitempty"`
	Duration     int64   `json:"duration_ms"`
}

// NewWebSocketService creates a new WebSocket service
func NewWebSocketService(hub WebSocketHub) WebSocketService {
	return &webSocketServiceImpl{
		hub: hub,
	}
}

// BroadcastDatabaseMetrics broadcasts database metrics to subscribed clients
func (ws *webSocketServiceImpl) BroadcastDatabaseMetrics(ctx context.Context, connectionID string, metrics *entities.DatabaseMetrics) error {
	if ws.hub == nil {
		return fmt.Errorf("WebSocket hub not initialized")
	}

	if metrics == nil {
		return fmt.Errorf("metrics cannot be nil")
	}

	if err := metrics.Validate(); err != nil {
		return fmt.Errorf("invalid metrics: %w", err)
	}

	ws.hub.BroadcastMetrics(connectionID, metrics)
	
	logrus.WithFields(logrus.Fields{
		"connection_id": connectionID,
		"cpu_usage":     metrics.CPUUsage,
		"memory_usage":  metrics.MemoryUsage,
		"active_conns":  metrics.ActiveConnections,
	}).Debug("Broadcasted database metrics")

	return nil
}

// BroadcastQueryProgress broadcasts query execution progress
func (ws *webSocketServiceImpl) BroadcastQueryProgress(ctx context.Context, queryID string, status string, progress float64, message string, duration time.Duration) error {
	if ws.hub == nil {
		return fmt.Errorf("WebSocket hub not initialized")
	}

	if queryID == "" {
		return fmt.Errorf("query ID cannot be empty")
	}

	progressData := &QueryProgressData{
		QueryID:  queryID,
		Status:   status,
		Progress: progress,
		Message:  message,
		Duration: duration.Milliseconds(),
	}

	ws.hub.BroadcastQueryProgress(queryID, progressData)
	
	logrus.WithFields(logrus.Fields{
		"query_id": queryID,
		"status":   status,
		"progress": progress,
		"duration": duration.Milliseconds(),
	}).Debug("Broadcasted query progress")

	return nil
}

// BroadcastQueryResult broadcasts final query results
func (ws *webSocketServiceImpl) BroadcastQueryResult(ctx context.Context, query *entities.Query) error {
	if ws.hub == nil {
		return fmt.Errorf("WebSocket hub not initialized")
	}

	if query == nil {
		return fmt.Errorf("query cannot be nil")
	}

	if err := query.Validate(); err != nil {
		return fmt.Errorf("invalid query: %w", err)
	}

	ws.hub.BroadcastQueryResult(query.ID, query)
	
	logrus.WithFields(logrus.Fields{
		"query_id":  query.ID,
		"status":    query.Status,
		"row_count": query.RowCount,
		"duration":  query.Duration,
	}).Debug("Broadcasted query result")

	return nil
}

// NotifyQueryStarted notifies clients that a query has started
func (ws *webSocketServiceImpl) NotifyQueryStarted(ctx context.Context, queryID string) error {
	return ws.BroadcastQueryProgress(ctx, queryID, entities.QueryStatusRunning, 0.0, "Query execution started", 0)
}

// NotifyQueryProgress notifies clients of query execution progress
func (ws *webSocketServiceImpl) NotifyQueryProgress(ctx context.Context, queryID string, progress float64, message string, duration time.Duration) error {
	return ws.BroadcastQueryProgress(ctx, queryID, entities.QueryStatusRunning, progress, message, duration)
}

// NotifyQueryCompleted notifies clients that a query has completed
func (ws *webSocketServiceImpl) NotifyQueryCompleted(ctx context.Context, query *entities.Query) error {
	// First send progress completion
	if err := ws.BroadcastQueryProgress(ctx, query.ID, entities.QueryStatusCompleted, 100.0, "Query completed successfully", time.Duration(query.Duration)*time.Millisecond); err != nil {
		return err
	}

	// Then send the full result
	return ws.BroadcastQueryResult(ctx, query)
}

// NotifyQueryFailed notifies clients that a query has failed
func (ws *webSocketServiceImpl) NotifyQueryFailed(ctx context.Context, queryID string, errorMsg string, duration time.Duration) error {
	return ws.BroadcastQueryProgress(ctx, queryID, entities.QueryStatusFailed, 0.0, fmt.Sprintf("Query failed: %s", errorMsg), duration)
}

// NotifyQueryCancelled notifies clients that a query has been cancelled
func (ws *webSocketServiceImpl) NotifyQueryCancelled(ctx context.Context, queryID string, duration time.Duration) error {
	return ws.BroadcastQueryProgress(ctx, queryID, entities.QueryStatusCancelled, 0.0, "Query was cancelled", duration)
}

// GetHubStats returns WebSocket hub statistics
func (ws *webSocketServiceImpl) GetHubStats(ctx context.Context) (map[string]interface{}, error) {
	if ws.hub == nil {
		return nil, fmt.Errorf("WebSocket hub not initialized")
	}

	return ws.hub.GetStats(), nil
}

// StartMetricsMonitoring starts periodic metrics monitoring for a connection
func (ws *webSocketServiceImpl) StartMetricsMonitoring(ctx context.Context, connectionID string, interval time.Duration, metricsService interface{}) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	logrus.WithFields(logrus.Fields{
		"connection_id": connectionID,
		"interval":      interval,
	}).Info("Started metrics monitoring")

	for {
		select {
		case <-ctx.Done():
			logrus.WithField("connection_id", connectionID).Info("Stopped metrics monitoring")
			return
		case <-ticker.C:
			// TODO: Implement metrics collection when MetricsService is available
			// This is a placeholder for now
			logrus.WithField("connection_id", connectionID).Debug("Metrics monitoring tick")
		}
	}
}

// ValidateWebSocketMessage validates incoming WebSocket messages
func (ws *webSocketServiceImpl) ValidateWebSocketMessage(messageType string, data interface{}) error {
	switch messageType {
	case "subscribe", "unsubscribe":
		if data == nil {
			return fmt.Errorf("room data is required for %s", messageType)
		}
		
		dataMap, ok := data.(map[string]interface{})
		if !ok {
			return fmt.Errorf("invalid data format for %s", messageType)
		}
		
		if _, exists := dataMap["room"]; !exists {
			return fmt.Errorf("room field is required for %s", messageType)
		}
		
	case "query_cancel":
		if data == nil {
			return fmt.Errorf("query data is required for query cancellation")
		}
		
		dataMap, ok := data.(map[string]interface{})
		if !ok {
			return fmt.Errorf("invalid data format for query cancellation")
		}
		
		if _, exists := dataMap["query_id"]; !exists {
			return fmt.Errorf("query_id field is required for query cancellation")
		}
		
	case "collab_edit":
		if data == nil {
			return fmt.Errorf("edit data is required for collaborative editing")
		}
		
		dataMap, ok := data.(map[string]interface{})
		if !ok {
			return fmt.Errorf("invalid data format for collaborative editing")
		}
		
		requiredFields := []string{"document_id", "operation"}
		for _, field := range requiredFields {
			if _, exists := dataMap[field]; !exists {
				return fmt.Errorf("%s field is required for collaborative editing", field)
			}
		}
	}
	
	return nil
}