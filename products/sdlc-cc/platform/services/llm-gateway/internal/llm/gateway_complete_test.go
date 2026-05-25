package llm

import (
	"context"
	"testing"
	"time"

	"github.com/SDLC/llm-gateway/internal/providers"
	"github.com/SDLC/llm-gateway/internal/validation"
	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockProviderForComplete implements providers.Provider and returns a fixed completion.
type mockProviderForComplete struct {
	name    string
	enabled bool
	resp    *models.CompletionResponse
}

func (m *mockProviderForComplete) Complete(ctx context.Context, req *models.CompletionRequest) (*models.CompletionResponse, error) {
	if m.resp != nil {
		return m.resp, nil
	}
	return &models.CompletionResponse{
		ID: "mock-id", Model: "mock-model", Provider: "mock",
		Usage: models.TokenUsage{PromptTokens: 5, CompletionTokens: 10, TotalTokens: 15},
		Cost:  0.01,
	}, nil
}

func (m *mockProviderForComplete) CompleteStream(context.Context, *models.CompletionRequest) (<-chan providers.StreamChunk, error) {
	ch := make(chan providers.StreamChunk)
	close(ch)
	return ch, nil
}

func (m *mockProviderForComplete) GetTokenCount(string) (int, error) { return 0, nil }

func (m *mockProviderForComplete) GetModelInfo() ([]models.ModelInfo, error) {
	return []models.ModelInfo{{ID: "mock-model", Name: "Mock", IsAvailable: true}}, nil
}

func (m *mockProviderForComplete) Health(context.Context) (*models.HealthStatus, error) {
	return &models.HealthStatus{Provider: m.name, Status: "healthy", LastChecked: time.Now()}, nil
}

func (m *mockProviderForComplete) GetModelCost(string, int, int) (float64, error) { return 0, nil }

func (m *mockProviderForComplete) GetName() string { return m.name }

func (m *mockProviderForComplete) IsEnabled() bool { return m.enabled }

func (m *mockProviderForComplete) SetEnabled(b bool) { m.enabled = b }

func (m *mockProviderForComplete) GetConfig() models.ProviderConfig {
	return models.ProviderConfig{Name: m.name, Type: "mock", Enabled: m.enabled, Priority: 1}
}

func (m *mockProviderForComplete) GetLastHealthCheck() time.Time { return time.Now() }

func (m *mockProviderForComplete) GetLastHealthStatus() *models.HealthStatus { return nil }

func TestComplete_ValidationError(t *testing.T) {
	v := validation.NewDefaultValidator(10000, 20, nil)
	cfg := &Config{
		DefaultProvider: "ollama",
		EnableValidation: true,
		Providers:       []models.ProviderConfig{{Name: "ollama", Type: "ollama", Enabled: true}},
	}
	gw := NewGateway(cfg, &mockCostTracker{}, v, nil, nil, logrus.New(), nil, nil)
	ctx := context.Background()

	req := &models.CompletionRequest{Model: "m", Messages: nil}
	resp, err := gw.Complete(ctx, req)
	require.Error(t, err)
	require.Nil(t, resp)
	assert.Contains(t, err.Error(), "validation failed")
}

func TestComplete_RecordCostWhenEnabled(t *testing.T) {
	spy := &spyCostTracker{}
	factory := providers.NewFactory(nil)
	factory.RegisterProvider("mock", &mockProviderForComplete{name: "mock", enabled: true})
	cfg := &Config{
		DefaultProvider:    "mock",
		EnableCostTracking: true,
		EnableValidation:   false,
		Budgets:            models.BudgetConfig{Currency: "USD"},
	}
	gw := NewGateway(cfg, spy, nil, nil, nil, logrus.New(), factory, nil)
	ctx := context.Background()

	req := &models.CompletionRequest{
		Model:    "mock-model",
		Messages: []models.Message{{Role: "user", Content: "hi"}},
		TenantID: "t1",
		UserID:   "u1",
	}
	resp, err := gw.Complete(ctx, req)
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.True(t, spy.recordCostCalled, "RecordCost should be called when cost tracking is enabled")
	require.NotNil(t, spy.lastCost)
	assert.Equal(t, "t1", spy.lastCost.TenantID)
	assert.Equal(t, "u1", spy.lastCost.UserID)
	assert.Equal(t, "mock", spy.lastCost.Provider)
	assert.Equal(t, 0.01, spy.lastCost.Cost)
}
