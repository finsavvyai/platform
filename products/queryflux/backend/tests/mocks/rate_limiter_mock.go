package mocks

import (
	"context"
	"time"

	"github.com/queryflux/backend/internal/domain"
	"github.com/stretchr/testify/mock"
)

// MockRateLimiter implements a mock rate limiter for testing
type MockRateLimiter struct {
	mock.Mock
}

func NewMockRateLimiter() *MockRateLimiter {
	return &MockRateLimiter{}
}

func (m *MockRateLimiter) Allow(ctx context.Context, userID string, service domain.AIService) (bool, time.Duration) {
	args := m.Called(ctx, userID, service)
	return args.Bool(0), args.Get(1).(time.Duration)
}

func (m *MockRateLimiter) GetLimit(ctx context.Context, userID string, service domain.AIService) (int, error) {
	args := m.Called(ctx, userID, service)
	return args.Int(0), args.Error(1)
}

func (m *MockRateLimiter) GetUsage(ctx context.Context, userID string, service domain.AIService) (int, error) {
	args := m.Called(ctx, userID, service)
	return args.Int(0), args.Error(1)
}

func (m *MockRateLimiter) Reset(ctx context.Context, userID string, service domain.AIService) error {
	args := m.Called(ctx, userID, service)
	return args.Error(0)
}

// SetLimit is a helper for testing
func (m *MockRateLimiter) SetLimit(userID string, service domain.AIService, limit int) {
	m.On("GetLimit", mock.Anything, userID, service).Return(limit, nil)
	m.On("Allow", mock.Anything, userID, service).Return(limit > 0, time.Duration(0))
}
