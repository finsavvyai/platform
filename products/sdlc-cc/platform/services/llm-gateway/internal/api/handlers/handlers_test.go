package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/SDLC/llm-gateway/internal/llm"
	"github.com/SDLC/llm-gateway/internal/providers"
	"github.com/SDLC/llm-gateway/internal/storage"
	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupHandler(t *testing.T, gw *llm.Gateway) *Handler {
	t.Helper()
	if gw == nil {
		cfg := &llm.Config{
			DefaultProvider: "ollama",
			Providers:       []models.ProviderConfig{},
		}
		gw = llm.NewGateway(cfg, &storage.MockCostTracker{}, nil, nil, nil, logrus.New(), nil, nil)
	}
	return NewHandler(gw, logrus.New())
}

func TestHealth_Returns200(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := setupHandler(t, nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/health", nil)

	h.Health(c)

	require.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Contains(t, body, "status")
	assert.Contains(t, body, "providers")
}

func TestValidateRequest_InvalidJSON_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := setupHandler(t, nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/validate", bytes.NewBufferString("not json"))
	c.Request.Header.Set("Content-Type", "application/json")

	h.ValidateRequest(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "Invalid request format")
}

func TestComplete_InvalidBody_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := setupHandler(t, nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/complete", bytes.NewBufferString("{"))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Complete(c)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "Invalid request format")
}

func TestComplete_ValidRequest_Returns200(t *testing.T) {
	mockProv := &mockProviderComplete{
		name: "mock", enabled: true,
		resp: &models.CompletionResponse{
			ID: "id", Model: "m", Provider: "mock",
			Usage: models.TokenUsage{PromptTokens: 1, CompletionTokens: 2, TotalTokens: 3},
			Cost:  0.001,
		},
	}
	factory := providers.NewFactory(nil)
	factory.RegisterProvider("mock", mockProv)
	cfg := &llm.Config{
		DefaultProvider:    "mock",
		EnableCostTracking: false,
		EnableValidation:   false,
	}
	gw := llm.NewGateway(cfg, &storage.MockCostTracker{}, nil, nil, nil, logrus.New(), factory, nil)
	h := setupHandler(t, gw)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := `{"model":"m","messages":[{"role":"user","content":"hi"}]}`
	c.Request = httptest.NewRequest(http.MethodPost, "/complete", bytes.NewBufferString(body))
	c.Request.Header.Set("Content-Type", "application/json")

	h.Complete(c)

	require.Equal(t, http.StatusOK, w.Code)
	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &out))
	assert.Equal(t, "id", out["id"])
	assert.Equal(t, "mock", out["provider"])
}

// mockProviderComplete implements providers.Provider for handler tests.
type mockProviderComplete struct {
	name    string
	enabled bool
	resp    *models.CompletionResponse
}

func (m *mockProviderComplete) Complete(_ context.Context, req *models.CompletionRequest) (*models.CompletionResponse, error) {
	if m.resp != nil {
		return m.resp, nil
	}
	return &models.CompletionResponse{ID: "id", Model: req.Model, Provider: m.name}, nil
}

func (m *mockProviderComplete) CompleteStream(context.Context, *models.CompletionRequest) (<-chan providers.StreamChunk, error) {
	ch := make(chan providers.StreamChunk)
	close(ch)
	return ch, nil
}

func (m *mockProviderComplete) GetTokenCount(string) (int, error) { return 0, nil }

func (m *mockProviderComplete) GetModelInfo() ([]models.ModelInfo, error) {
	return []models.ModelInfo{{ID: "m", IsAvailable: true}}, nil
}

func (m *mockProviderComplete) Health(context.Context) (*models.HealthStatus, error) {
	return &models.HealthStatus{Provider: m.name, Status: "healthy"}, nil
}

func (m *mockProviderComplete) GetModelCost(string, int, int) (float64, error) { return 0, nil }

func (m *mockProviderComplete) GetName() string     { return m.name }
func (m *mockProviderComplete) IsEnabled() bool    { return m.enabled }
func (m *mockProviderComplete) SetEnabled(b bool)   { m.enabled = b }
func (m *mockProviderComplete) GetConfig() models.ProviderConfig {
	return models.ProviderConfig{Name: m.name, Enabled: m.enabled, Priority: 1}
}

func (m *mockProviderComplete) GetLastHealthCheck() time.Time              { return time.Now() }
func (m *mockProviderComplete) GetLastHealthStatus() *models.HealthStatus { return nil }
