package storage

import (
	"context"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// MockCostTracker provides a mock implementation for testing
type MockCostTracker struct{}

// NewMockCostTracker returns a new MockCostTracker
func NewMockCostTracker() *MockCostTracker {
	return &MockCostTracker{}
}

func (m *MockCostTracker) RecordCost(ctx context.Context, cost *models.CostRecord) error {
	return nil
}

func (m *MockCostTracker) GetCurrentUsage(ctx context.Context, tenantID, userID string) (*UsageStats, error) {
	return &UsageStats{
		TenantID:        tenantID,
		UserID:          userID,
		DailySpend:      5.0,
		MonthlySpend:    50.0,
		DailyTokens:     1000,
		MonthlyTokens:   10000,
		RequestsCount:   25,
		LastRequestTime: time.Now(),
	}, nil
}

func (m *MockCostTracker) GetCostHistory(ctx context.Context, tenantID, userID string, startTime, endTime time.Time) ([]*models.CostRecord, error) {
	return []*models.CostRecord{}, nil
}

func (m *MockCostTracker) GetCostSummary(ctx context.Context, tenantID, userID string, period string) (*CostSummary, error) {
	return &CostSummary{
		Period:              period,
		TotalCost:           50.0,
		TotalTokens:         10000,
		CostByProvider:      map[string]float64{"openai": 30.0, "anthropic": 20.0},
		CostByModel:         map[string]float64{"gpt-4": 30.0, "claude-3": 20.0},
		AverageCostPerToken: 0.005,
	}, nil
}

func (m *MockCostTracker) UpdateBudget(ctx context.Context, budget *models.Budget) error {
	return nil
}

func (m *MockCostTracker) GetBudget(ctx context.Context, tenantID, userID string) (*models.Budget, error) {
	return &models.Budget{
		ID:             "mock-budget",
		TenantID:       tenantID,
		UserID:         userID,
		MonthlyLimit:   100.0,
		DailyLimit:     10.0,
		AlertThreshold: 80.0,
		CurrentSpend:   5.0,
		Currency:       "USD",
		Period:         "monthly",
		IsActive:       true,
	}, nil
}

func (m *MockCostTracker) GetTopSpenders(ctx context.Context, tenantID string, limit int) ([]*SpenderInfo, error) {
	return []*SpenderInfo{}, nil
}
