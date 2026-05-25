package storage

import (
	"context"
	"testing"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Ensure MockCostTracker implements CostTracker
var _ CostTracker = (*MockCostTracker)(nil)

func TestMockCostTracker_RecordCost(t *testing.T) {
	m := NewMockCostTracker()
	ctx := context.Background()
	err := m.RecordCost(ctx, &models.CostRecord{
		TenantID: "t1", UserID: "u1", Provider: "openai", Model: "gpt-4",
		PromptTokens: 10, OutputTokens: 20, Cost: 0.01,
	})
	require.NoError(t, err)
}

func TestMockCostTracker_GetCurrentUsage(t *testing.T) {
	m := NewMockCostTracker()
	ctx := context.Background()
	stats, err := m.GetCurrentUsage(ctx, "tenant1", "user1")
	require.NoError(t, err)
	require.NotNil(t, stats)
	assert.Equal(t, "tenant1", stats.TenantID)
	assert.Equal(t, "user1", stats.UserID)
	assert.Equal(t, 5.0, stats.DailySpend)
	assert.Equal(t, 50.0, stats.MonthlySpend)
	assert.Equal(t, 1000, stats.DailyTokens)
	assert.Equal(t, 10000, stats.MonthlyTokens)
	assert.Equal(t, 25, stats.RequestsCount)
}

func TestMockCostTracker_GetCostHistory(t *testing.T) {
	m := NewMockCostTracker()
	ctx := context.Background()
	start := time.Now().Add(-24 * time.Hour)
	end := time.Now()
	records, err := m.GetCostHistory(ctx, "t1", "u1", start, end)
	require.NoError(t, err)
	assert.NotNil(t, records)
	assert.Empty(t, records)
}

func TestMockCostTracker_GetCostSummary(t *testing.T) {
	m := NewMockCostTracker()
	ctx := context.Background()
	sum, err := m.GetCostSummary(ctx, "t1", "u1", "monthly")
	require.NoError(t, err)
	require.NotNil(t, sum)
	assert.Equal(t, "monthly", sum.Period)
	assert.Equal(t, 50.0, sum.TotalCost)
	assert.Equal(t, 10000, sum.TotalTokens)
	assert.Equal(t, 0.005, sum.AverageCostPerToken)
	assert.Contains(t, sum.CostByProvider, "openai")
	assert.Contains(t, sum.CostByModel, "gpt-4")
}

func TestMockCostTracker_UpdateBudget(t *testing.T) {
	m := NewMockCostTracker()
	ctx := context.Background()
	err := m.UpdateBudget(ctx, &models.Budget{TenantID: "t1", UserID: "u1"})
	require.NoError(t, err)
}

func TestMockCostTracker_GetBudget(t *testing.T) {
	m := NewMockCostTracker()
	ctx := context.Background()
	budget, err := m.GetBudget(ctx, "tenant1", "user1")
	require.NoError(t, err)
	require.NotNil(t, budget)
	assert.Equal(t, "mock-budget", budget.ID)
	assert.Equal(t, "tenant1", budget.TenantID)
	assert.Equal(t, "user1", budget.UserID)
	assert.Equal(t, 100.0, budget.MonthlyLimit)
	assert.True(t, budget.IsActive)
}

func TestMockCostTracker_GetTopSpenders(t *testing.T) {
	m := NewMockCostTracker()
	ctx := context.Background()
	spenders, err := m.GetTopSpenders(ctx, "t1", 10)
	require.NoError(t, err)
	assert.NotNil(t, spenders)
	assert.Empty(t, spenders)
}
