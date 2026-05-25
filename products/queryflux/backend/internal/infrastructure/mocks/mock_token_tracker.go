package mocks

import (
	"context"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/domain"
)

// MockTokenTracker implements TokenTracker
type MockTokenTracker struct {
	usages  map[string]map[domain.AIService]*TokenUsage
	budgets map[string]map[domain.AIService]float64
	mu      sync.RWMutex
}

type TokenUsage struct {
	TokensUsed int
	Cost       float64
}

func NewMockTokenTracker() *MockTokenTracker {
	return &MockTokenTracker{
		usages:  make(map[string]map[domain.AIService]*TokenUsage),
		budgets: make(map[string]map[domain.AIService]float64),
	}
}

func (m *MockTokenTracker) TrackUsage(ctx context.Context, userID string, service domain.AIService, tokensUsed int, cost float64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.usages[userID] == nil {
		m.usages[userID] = make(map[domain.AIService]*TokenUsage)
	}

	if m.usages[userID][service] == nil {
		m.usages[userID][service] = &TokenUsage{}
	}

	m.usages[userID][service].TokensUsed += tokensUsed
	m.usages[userID][service].Cost += cost

	return nil
}

func (m *MockTokenTracker) GetUsage(ctx context.Context, userID string, service domain.AIService, startDate, endDate time.Time) (int, float64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if userUsages, ok := m.usages[userID]; ok {
		if usage, ok := userUsages[service]; ok {
			return usage.TokensUsed, usage.Cost, nil
		}
	}

	return 0, 0, nil
}

func (m *MockTokenTracker) GetUsageByOperation(ctx context.Context, userID string, service domain.AIService, operation string, startDate, endDate time.Time) (int, float64, error) {
	return m.GetUsage(ctx, userID, service, startDate, endDate)
}

func (m *MockTokenTracker) SetBudget(ctx context.Context, userID string, service domain.AIService, budget float64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.budgets[userID] == nil {
		m.budgets[userID] = make(map[domain.AIService]float64)
	}

	m.budgets[userID][service] = budget
	return nil
}

func (m *MockTokenTracker) GetBudget(ctx context.Context, userID string, service domain.AIService) (float64, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if userBudgets, ok := m.budgets[userID]; ok {
		if budget, ok := userBudgets[service]; ok {
			return budget, nil
		}
	}

	return 100.0, nil
}

func (m *MockTokenTracker) CheckBudget(ctx context.Context, userID string, service domain.AIService, estimatedCost float64) (bool, error) {
	budget, err := m.GetBudget(ctx, userID, service)
	if err != nil {
		return false, err
	}

	_, currentCost, err := m.GetUsage(ctx, userID, service, time.Time{}, time.Now())
	if err != nil {
		return false, err
	}

	return (currentCost + estimatedCost) <= budget, nil
}
