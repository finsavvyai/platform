package mocks

import (
	"context"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/queryflux/backend/internal/domain"
)

// MockTokenTracker implements a mock token tracker for testing
type MockTokenTracker struct {
	mock.Mock
}

func NewMockTokenTracker() *MockTokenTracker {
	return &MockTokenTracker{}
}

func (m *MockTokenTracker) TrackUsage(ctx context.Context, userID string, service domain.AIService, tokensUsed int, cost float64) error {
	args := m.Called(ctx, userID, service, tokensUsed, cost)
	return args.Error(0)
}

func (m *MockTokenTracker) GetUsage(ctx context.Context, userID string, service domain.AIService, startDate, endDate time.Time) (int, float64, error) {
	args := m.Called(ctx, userID, service, startDate, endDate)
	return args.Int(0), args.Get(1).(float64), args.Error(2)
}

func (m *MockTokenTracker) GetUsageByOperation(ctx context.Context, userID string, service domain.AIService, operation string, startDate, endDate time.Time) (int, float64, error) {
	args := m.Called(ctx, userID, service, operation, startDate, endDate)
	return args.Int(0), args.Get(1).(float64), args.Error(2)
}

func (m *MockTokenTracker) SetBudget(ctx context.Context, userID string, service domain.AIService, budget float64) error {
	args := m.Called(ctx, userID, service, budget)
	return args.Error(0)
}

func (m *MockTokenTracker) GetBudget(ctx context.Context, userID string, service domain.AIService) (float64, error) {
	args := m.Called(ctx, userID, service)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockTokenTracker) CheckBudget(ctx context.Context, userID string, service domain.AIService, estimatedCost float64) (bool, error) {
	args := m.Called(ctx, userID, service, estimatedCost)
	return args.Bool(0), args.Error(1)
}