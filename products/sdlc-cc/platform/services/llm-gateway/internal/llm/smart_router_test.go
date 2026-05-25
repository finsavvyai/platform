package llm

import (
	"context"
	"testing"
	"time"

	"github.com/SDLC/llm-gateway/internal/providers"
	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

// mockProvider implements providers.Provider for testing.
type mockProvider struct {
	providers.BaseProvider
}

func newMockProvider(name string, priority int) *mockProvider {
	return &mockProvider{
		BaseProvider: *providers.NewBaseProvider(name, models.ProviderConfig{
			Name:     name,
			Enabled:  true,
			Priority: priority,
		}),
	}
}

func (m *mockProvider) Complete(_ context.Context, _ *models.CompletionRequest) (*models.CompletionResponse, error) {
	return nil, nil
}
func (m *mockProvider) CompleteStream(_ context.Context, _ *models.CompletionRequest) (<-chan providers.StreamChunk, error) {
	return nil, nil
}
func (m *mockProvider) GetTokenCount(_ string) (int, error) { return 0, nil }
func (m *mockProvider) GetModelInfo() ([]models.ModelInfo, error) {
	return nil, nil
}
func (m *mockProvider) Health(_ context.Context) (*models.HealthStatus, error) {
	return nil, nil
}
func (m *mockProvider) GetModelCost(_ string, _, _ int) (float64, error) {
	return 0, nil
}

func newTestRouter() *SmartRouter {
	logger := logrus.New()
	logger.SetLevel(logrus.DebugLevel)
	return NewSmartRouter(logger)
}

func TestColdStartReturnsPriorityOrder(t *testing.T) {
	sr := newTestRouter()
	a := newMockProvider("openai", 1)
	b := newMockProvider("anthropic", 2)

	candidates := []providers.Provider{a, b}
	selected := sr.SelectProvider("gpt-4", candidates)
	assert.Equal(t, "openai", selected.GetName())
}

func TestSelectProviderAfterWarmup(t *testing.T) {
	sr := newTestRouter()

	// Record outcomes: anthropic is better (100% success, lower latency)
	for i := 0; i < 15; i++ {
		sr.RecordOutcome("openai", "gpt-4", i%3 != 0, 200)     // 66% success
		sr.RecordOutcome("anthropic", "gpt-4", true, 100)        // 100% success
	}

	a := newMockProvider("openai", 1)
	b := newMockProvider("anthropic", 2)

	selected := sr.SelectProvider("gpt-4", []providers.Provider{a, b})
	assert.Equal(t, "anthropic", selected.GetName())
}

func TestRecordOutcomeAndGetStats(t *testing.T) {
	sr := newTestRouter()

	sr.RecordOutcome("openai", "gpt-4", true, 100)
	sr.RecordOutcome("openai", "gpt-4", true, 200)
	sr.RecordOutcome("openai", "gpt-4", false, 300)

	stats := sr.GetStats()
	s, ok := stats["openai:gpt-4"]
	assert.True(t, ok)
	assert.Equal(t, 3, s.TotalCalls)
	assert.Equal(t, 2, s.Successes)
	assert.InDelta(t, 0.666, s.SuccessRate, 0.01)
	assert.InDelta(t, 200.0, s.AvgLatency, 0.1)
}

func TestDecayPrunesOldEntries(t *testing.T) {
	sr := newTestRouter()

	// Manually inject an old outcome
	sr.mu.Lock()
	sr.outcomes["openai:gpt-4"] = []outcome{
		{success: true, latencyMs: 100, timestamp: time.Now().Add(-2 * time.Hour)},
	}
	sr.mu.Unlock()

	// Record a new one — prune should kick in
	sr.RecordOutcome("openai", "gpt-4", false, 200)

	stats := sr.GetStats()
	s := stats["openai:gpt-4"]
	assert.Equal(t, 1, s.TotalCalls, "old entry should have been pruned")
	assert.Equal(t, 0, s.Successes)
}

func TestSelectProviderEmptyCandidates(t *testing.T) {
	sr := newTestRouter()
	selected := sr.SelectProvider("gpt-4", nil)
	assert.Nil(t, selected)
}

func TestRouterKeyParsing(t *testing.T) {
	p, m := parseRouterKey("openai:gpt-4")
	assert.Equal(t, "openai", p)
	assert.Equal(t, "gpt-4", m)

	p2, m2 := parseRouterKey("nomodel")
	assert.Equal(t, "nomodel", p2)
	assert.Equal(t, "", m2)
}

func TestComputeStatsEmpty(t *testing.T) {
	s := computeStats("x", "y", nil)
	assert.Equal(t, 0, s.TotalCalls)
	assert.Equal(t, 0.0, s.Score)
}

func TestScoreFormula(t *testing.T) {
	// All successes, uniform latency → score should be success_rate * (max/avg) = 1 * 1 = 1
	entries := make([]outcome, 20)
	for i := range entries {
		entries[i] = outcome{success: true, latencyMs: 100, timestamp: time.Now()}
	}
	s := computeStats("p", "m", entries)
	assert.Equal(t, 1.0, s.SuccessRate)
	assert.InDelta(t, 1.0, s.Score, 0.01)
}
