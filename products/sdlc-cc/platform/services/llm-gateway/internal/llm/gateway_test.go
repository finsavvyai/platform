package llm

import (
	"context"
	"testing"
	"time"

	"github.com/SDLC/llm-gateway/internal/storage"
	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

type mockCostTracker struct{}

func (m *mockCostTracker) RecordCost(ctx context.Context, cost *models.CostRecord) error {
	return nil
}

func (m *mockCostTracker) GetCurrentUsage(ctx context.Context, tenantID, userID string) (*storage.UsageStats, error) {
	return &storage.UsageStats{
		TenantID: tenantID, UserID: userID,
		DailySpend: 0, MonthlySpend: 0,
		LastRequestTime: time.Now(), RequestsCount: 0,
	}, nil
}

func (m *mockCostTracker) GetCostHistory(ctx context.Context, tenantID, userID string, _, _ time.Time) ([]*models.CostRecord, error) {
	return nil, nil
}

func (m *mockCostTracker) GetCostSummary(ctx context.Context, tenantID, userID string, period string) (*storage.CostSummary, error) {
	return &storage.CostSummary{
		Period: period, CostByProvider: map[string]float64{},
		CostByModel: map[string]float64{}, CostByUser: map[string]float64{},
	}, nil
}

func (m *mockCostTracker) UpdateBudget(ctx context.Context, budget *models.Budget) error { return nil }

func (m *mockCostTracker) GetBudget(ctx context.Context, tenantID, userID string) (*models.Budget, error) {
	return &models.Budget{ID: "b", TenantID: tenantID, UserID: userID, Currency: "USD", IsActive: true}, nil
}

func (m *mockCostTracker) GetTopSpenders(ctx context.Context, tenantID string, limit int) ([]*storage.SpenderInfo, error) {
	return nil, nil
}

// spyCostTracker records whether RecordCost was called and the last cost record.
type spyCostTracker struct {
	mockCostTracker
	recordCostCalled bool
	lastCost         *models.CostRecord
}

func (s *spyCostTracker) RecordCost(ctx context.Context, cost *models.CostRecord) error {
	s.recordCostCalled = true
	s.lastCost = cost
	return nil
}

func TestGateway_GetAvailableModels_ListProviders(t *testing.T) {
	cfg := &Config{
		DefaultProvider:   "ollama",
		EnableValidation:  false,
		EnableCostTracking: false,
		Providers: []models.ProviderConfig{
			{Name: "ollama", Type: "ollama", Enabled: true, Priority: 1,
				Models: []models.ModelConfig{{ID: "llama2", Name: "Llama 2", Enabled: true}}},
		},
	}
	gw := NewGateway(cfg, &mockCostTracker{}, nil, nil, nil, logrus.New(), nil, nil)
	require.NotNil(t, gw)

	ctx := context.Background()

	modelsOut, err := gw.GetAvailableModels(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, modelsOut)
	require.Equal(t, "ollama", modelsOut[0].Provider)

	providers := gw.ListProviders()
	require.Len(t, providers, 1)
	_, ok := providers["ollama"]
	require.True(t, ok)

	p, err := gw.GetProvider("ollama")
	require.NoError(t, err)
	require.Equal(t, "ollama", p.GetName())
}

func TestGateway_EnableDisableProvider(t *testing.T) {
	cfg := &Config{
		DefaultProvider: "ollama",
		Providers: []models.ProviderConfig{
			{Name: "ollama", Type: "ollama", Enabled: true, Priority: 1},
		},
	}
	gw := NewGateway(cfg, &mockCostTracker{}, nil, nil, nil, logrus.New(), nil, nil)

	require.NoError(t, gw.DisableProvider("ollama"))
	_, err := gw.GetProvider("ollama")
	require.Error(t, err)

	require.NoError(t, gw.EnableProvider("ollama"))
	_, err = gw.GetProvider("ollama")
	require.NoError(t, err)
}

func TestGateway_GetProviderHealth(t *testing.T) {
	cfg := &Config{
		DefaultProvider: "ollama",
		Providers: []models.ProviderConfig{
			{Name: "ollama", Type: "ollama", Enabled: true},
		},
	}
	gw := NewGateway(cfg, &mockCostTracker{}, nil, nil, nil, logrus.New(), nil, nil)
	ctx := context.Background()

	health := gw.GetProviderHealth(ctx)
	require.Len(t, health, 1)
	require.Contains(t, health, "ollama")
}
