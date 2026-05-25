package websocket_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// QueryProgressData represents query execution progress
type QueryProgressData struct {
	QueryID      string  `json:"query_id"`
	Status       string  `json:"status"`
	Progress     float64 `json:"progress"`
	Message      string  `json:"message"`
	RowsAffected int     `json:"rows_affected,omitempty"`
	Duration     int64   `json:"duration_ms"`
}

// MockWebSocketHub is a mock implementation of WebSocketHub
type MockWebSocketHub struct {
	mock.Mock
}

func (m *MockWebSocketHub) BroadcastMetrics(connectionID string, metrics *entities.DatabaseMetrics) {
	m.Called(connectionID, metrics)
}

func (m *MockWebSocketHub) BroadcastQueryProgress(queryID string, progress *QueryProgressData) {
	m.Called(queryID, progress)
}

func (m *MockWebSocketHub) BroadcastQueryResult(queryID string, query *entities.Query) {
	m.Called(queryID, query)
}

func (m *MockWebSocketHub) GetStats() map[string]interface{} {
	args := m.Called()
	return args.Get(0).(map[string]interface{})
}

// WebSocketService for testing
type WebSocketService struct {
	hub WebSocketHub
}

type WebSocketHub interface {
	BroadcastMetrics(connectionID string, metrics *entities.DatabaseMetrics)
	BroadcastQueryProgress(queryID string, progress *QueryProgressData)
	BroadcastQueryResult(queryID string, query *entities.Query)
	GetStats() map[string]interface{}
}

func NewWebSocketService(hub WebSocketHub) *WebSocketService {
	return &WebSocketService{hub: hub}
}

func (ws *WebSocketService) BroadcastDatabaseMetrics(ctx context.Context, connectionID string, metrics *entities.DatabaseMetrics) error {
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
	return nil
}

func (ws *WebSocketService) ValidateWebSocketMessage(messageType string, data interface{}) error {
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

// TestWebSocketService_BroadcastDatabaseMetrics tests broadcasting database metrics
func TestWebSocketService_BroadcastDatabaseMetrics(t *testing.T) {
	mockHub := &MockWebSocketHub{}
	service := NewWebSocketService(mockHub)
	ctx := context.Background()

	t.Run("Should broadcast valid metrics", func(t *testing.T) {
		connectionID := "test-connection-1"
		metrics := &entities.DatabaseMetrics{
			ID:                "test-metrics-1",
			ConnectionID:      connectionID,
			CPUUsage:          75.5,
			MemoryUsage:       60.2,
			ActiveConnections: 10,
			QueriesPerSecond:  25.5,
			AverageQueryTime:  150.0,
			DiskUsage:         45.8,
			Timestamp:         time.Now(),
		}

		mockHub.On("BroadcastMetrics", connectionID, metrics).Once()

		err := service.BroadcastDatabaseMetrics(ctx, connectionID, metrics)

		assert.NoError(t, err)
		mockHub.AssertExpectations(t)
	})

	t.Run("Should return error for nil metrics", func(t *testing.T) {
		connectionID := "test-connection-1"

		err := service.BroadcastDatabaseMetrics(ctx, connectionID, nil)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "metrics cannot be nil")
	})

	t.Run("Should return error for invalid metrics", func(t *testing.T) {
		connectionID := "test-connection-1"
		metrics := &entities.DatabaseMetrics{
			ID:           "test-metrics-1",
			ConnectionID: "", // Invalid - empty connection ID
			CPUUsage:     75.5,
		}

		err := service.BroadcastDatabaseMetrics(ctx, connectionID, metrics)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid metrics")
	})

	t.Run("Should return error when hub is nil", func(t *testing.T) {
		service := NewWebSocketService(nil)
		connectionID := "test-connection-1"
		metrics := &entities.DatabaseMetrics{
			ID:           "test-metrics-1",
			ConnectionID: connectionID,
			CPUUsage:     75.5,
			Timestamp:    time.Now(),
		}

		err := service.BroadcastDatabaseMetrics(ctx, connectionID, metrics)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "WebSocket hub not initialized")
	})
}

// TestWebSocketService_BroadcastQueryProgress tests broadcasting query progress
func TestWebSocketService_BroadcastQueryProgress(t *testing.T) {
	mockHub := &MockWebSocketHub{}
	service := NewWebSocketService(mockHub)

	t.Run("Should broadcast query progress", func(t *testing.T) {
		queryID := "test-query-1"
		progress := &QueryProgressData{
			QueryID:  queryID,
			Status:   "running",
			Progress: 50.0,
			Message:  "Processing rows...",
			Duration: 1500,
		}

		mockHub.On("BroadcastQueryProgress", queryID, mock.MatchedBy(func(p *QueryProgressData) bool {
			return p.QueryID == progress.QueryID &&
				p.Status == progress.Status &&
				p.Progress == progress.Progress &&
				p.Message == progress.Message &&
				p.Duration == progress.Duration
		})).Once()

		service.hub.BroadcastQueryProgress(queryID, progress)

		mockHub.AssertExpectations(t)
	})
}

// TestWebSocketService_ValidateWebSocketMessage tests WebSocket message validation
func TestWebSocketService_ValidateWebSocketMessage(t *testing.T) {
	mockHub := &MockWebSocketHub{}
	service := NewWebSocketService(mockHub)

	t.Run("Should validate subscribe message", func(t *testing.T) {
		data := map[string]interface{}{
			"room": "metrics_test-connection",
		}

		err := service.ValidateWebSocketMessage("subscribe", data)
		assert.NoError(t, err)
	})

	t.Run("Should validate unsubscribe message", func(t *testing.T) {
		data := map[string]interface{}{
			"room": "query_test-query",
		}

		err := service.ValidateWebSocketMessage("unsubscribe", data)
		assert.NoError(t, err)
	})

	t.Run("Should validate query cancel message", func(t *testing.T) {
		data := map[string]interface{}{
			"query_id": "test-query-1",
		}

		err := service.ValidateWebSocketMessage("query_cancel", data)
		assert.NoError(t, err)
	})

	t.Run("Should validate collaborative edit message", func(t *testing.T) {
		data := map[string]interface{}{
			"document_id": "test-doc-1",
			"operation":   "insert",
			"position":    10,
			"content":     "SELECT * FROM users",
		}

		err := service.ValidateWebSocketMessage("collab_edit", data)
		assert.NoError(t, err)
	})

	t.Run("Should return error for subscribe without room", func(t *testing.T) {
		data := map[string]interface{}{}

		err := service.ValidateWebSocketMessage("subscribe", data)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "room field is required")
	})

	t.Run("Should return error for query cancel without query_id", func(t *testing.T) {
		data := map[string]interface{}{}

		err := service.ValidateWebSocketMessage("query_cancel", data)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "query_id field is required")
	})

	t.Run("Should return error for collab edit without required fields", func(t *testing.T) {
		data := map[string]interface{}{
			"document_id": "test-doc-1",
			// Missing operation field
		}

		err := service.ValidateWebSocketMessage("collab_edit", data)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "operation field is required")
	})

	t.Run("Should return error for nil data when required", func(t *testing.T) {
		err := service.ValidateWebSocketMessage("subscribe", nil)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "room data is required")
	})

	t.Run("Should return error for invalid data format", func(t *testing.T) {
		err := service.ValidateWebSocketMessage("subscribe", "invalid-data")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid data format")
	})
}