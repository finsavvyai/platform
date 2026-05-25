package mocks

import (
	"context"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain"
)

// MockAuditLogger implements AuditLogger
type MockAuditLogger struct {
	logs []auditEntry
	mu   sync.RWMutex
}

type auditEntry struct {
	timestamp time.Time
	eventType string
	data      interface{}
}

func NewMockAuditLogger() *MockAuditLogger {
	return &MockAuditLogger{
		logs: []auditEntry{},
	}
}

func (m *MockAuditLogger) LogRequest(ctx context.Context, request *domain.AIRequest) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logs = append(m.logs, auditEntry{
		timestamp: time.Now(),
		eventType: "request",
		data:      request,
	})

	return nil
}

func (m *MockAuditLogger) LogResponse(ctx context.Context, response *domain.AIResponse) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logs = append(m.logs, auditEntry{
		timestamp: time.Now(),
		eventType: "response",
		data:      response,
	})

	return nil
}

func (m *MockAuditLogger) LogError(ctx context.Context, requestID string, error error) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logs = append(m.logs, auditEntry{
		timestamp: time.Now(),
		eventType: "error",
		data: map[string]interface{}{
			"request_id": requestID,
			"error":      error.Error(),
		},
	})

	return nil
}

func (m *MockAuditLogger) LogDataAccess(ctx context.Context, userID string, operation string, dataAccessed interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.logs = append(m.logs, auditEntry{
		timestamp: time.Now(),
		eventType: "data_access",
		data: map[string]interface{}{
			"user_id":       userID,
			"operation":     operation,
			"data_accessed": dataAccessed,
		},
	})

	return nil
}

func (m *MockAuditLogger) GetAuditLogs(ctx context.Context, userID string, startDate, endDate time.Time) ([]interface{}, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var filtered []interface{}
	for _, entry := range m.logs {
		if entry.timestamp.After(startDate) && entry.timestamp.Before(endDate) {
			if userID == "" {
				filtered = append(filtered, entry.data)
			} else {
				if dataMap, ok := entry.data.(map[string]interface{}); ok {
					if uid, exists := dataMap["user_id"]; exists && uid == userID {
						filtered = append(filtered, entry.data)
					}
				}
			}
		}
	}

	return filtered, nil
}

func (m *MockAuditLogger) GetAuditLogsByOperation(ctx context.Context, operation string, startDate, endDate time.Time) ([]interface{}, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var filtered []interface{}
	for _, entry := range m.logs {
		if entry.eventType == operation && entry.timestamp.After(startDate) && entry.timestamp.Before(endDate) {
			filtered = append(filtered, entry.data)
		}
	}

	return filtered, nil
}

func (m *MockAuditLogger) GetAuditLogsByService(ctx context.Context, service domain.AIService, startDate, endDate time.Time) ([]interface{}, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var filtered []interface{}
	for _, entry := range m.logs {
		if entry.timestamp.After(startDate) && entry.timestamp.Before(endDate) {
			if dataMap, ok := entry.data.(map[string]interface{}); ok {
				if svc, exists := dataMap["service"]; exists && svc == service {
					filtered = append(filtered, entry.data)
				}
			}
		}
	}

	return filtered, nil
}
