package tests

import (
	"context"
	"testing"
	"time"

	"github.com/SDLC/llm-gateway/internal/llm"
	"github.com/SDLC/llm-gateway/internal/storage"
	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockCostTracker implements storage.CostTracker for tests
type mockCostTracker struct{}

func (m *mockCostTracker) RecordCost(ctx context.Context, cost *models.CostRecord) error {
	return nil
}

func (m *mockCostTracker) GetCurrentUsage(ctx context.Context, tenantID, userID string) (*storage.UsageStats, error) {
	return &storage.UsageStats{
		TenantID: tenantID, UserID: userID,
		DailySpend: 0, MonthlySpend: 0,
		DailyTokens: 0, MonthlyTokens: 0,
		LastRequestTime: time.Now(), RequestsCount: 0,
	}, nil
}

func (m *mockCostTracker) GetCostHistory(ctx context.Context, tenantID, userID string,
	startTime, endTime time.Time) ([]*models.CostRecord, error) {
	return nil, nil
}

func (m *mockCostTracker) GetCostSummary(ctx context.Context, tenantID, userID string,
	period string) (*storage.CostSummary, error) {
	return &storage.CostSummary{
		Period: period, TotalCost: 0, TotalTokens: 0,
		CostByProvider: make(map[string]float64),
		CostByModel:    make(map[string]float64),
		CostByUser:     make(map[string]float64),
	}, nil
}

func (m *mockCostTracker) UpdateBudget(ctx context.Context, budget *models.Budget) error {
	return nil
}

func (m *mockCostTracker) GetBudget(ctx context.Context, tenantID, userID string) (*models.Budget, error) {
	return &models.Budget{
		ID: "test", TenantID: tenantID, UserID: userID,
		MonthlyLimit: 100, DailyLimit: 10, Currency: "USD",
		Period: "monthly", IsActive: true,
	}, nil
}

func (m *mockCostTracker) GetTopSpenders(ctx context.Context, tenantID string, limit int) ([]*storage.SpenderInfo, error) {
	return nil, nil
}

func TestModels_CompletionRequest(t *testing.T) {
	req := models.CompletionRequest{
		Model:    "gpt-4",
		Messages: []models.Message{{Role: "user", Content: "Hi"}},
		TenantID: "t1",
		UserID:   "u1",
	}
	assert.Equal(t, "gpt-4", req.Model)
	assert.Len(t, req.Messages, 1)
	assert.Equal(t, "user", req.Messages[0].Role)
}

func TestGateway_NewGateway(t *testing.T) {
	cfg := &llm.Config{
		DefaultProvider:    "openai",
		MaxRetries:          2,
		EnableFailover:      true,
		EnableCostTracking:  false,
		EnableValidation:    false,
		Providers:           []models.ProviderConfig{},
	}
	ct := &mockCostTracker{}
	logger := logrus.New()
	gw := llm.NewGateway(cfg, ct, nil, nil, nil, logger, nil, nil)
	require.NotNil(t, gw)
}
