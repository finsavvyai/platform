package mocks

import (
	"context"
	"sync"

	"github.com/queryflux/backend/internal/domain"
)

// MockAIHealthChecker implements AIHealthChecker
type MockAIHealthChecker struct {
	healthStatus map[domain.AIService]error
	mu           sync.RWMutex
}

func NewMockAIHealthChecker() *MockAIHealthChecker {
	return &MockAIHealthChecker{
		healthStatus: make(map[domain.AIService]error),
	}
}

func (m *MockAIHealthChecker) CheckHealth(ctx context.Context, service domain.AIService) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if err, ok := m.healthStatus[service]; ok {
		return err
	}

	return nil
}

func (m *MockAIHealthChecker) GetHealthStatus(ctx context.Context) (map[domain.AIService]error, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	status := make(map[domain.AIService]error)
	for service, err := range m.healthStatus {
		status[service] = err
	}

	return status, nil
}

func (m *MockAIHealthChecker) SetHealthCallback(ctx context.Context, service domain.AIService, callback func(error)) error {
	err := m.CheckHealth(ctx, service)
	if callback != nil {
		callback(err)
	}

	return nil
}

func (m *MockAIHealthChecker) SetUnhealthy(service domain.AIService, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.healthStatus[service] = err
}

func (m *MockAIHealthChecker) SetHealthy(service domain.AIService) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.healthStatus, service)
}
