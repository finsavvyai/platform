package providers

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestShouldRetry_RetryableErrors(t *testing.T) {
	tests := []struct {
		name   string
		errStr string
	}{
		{"connection", "connection refused"},
		{"timeout", "context deadline exceeded: timeout"},
		{"rate limit", "rate limit exceeded"},
		{"too many requests", "too many requests (429)"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := errors.New(tt.errStr)
			assert.True(t, ShouldRetry(err, 0), "attempt 0 should retry")
			assert.True(t, ShouldRetry(err, 1), "attempt 1 should retry")
			assert.True(t, ShouldRetry(err, 2), "attempt 2 should retry")
		})
	}
}

func TestShouldRetry_NonRetryableError(t *testing.T) {
	err := errors.New("invalid model name")
	assert.False(t, ShouldRetry(err, 0))
	assert.False(t, ShouldRetry(err, 1))
}

func TestShouldRetry_NilError(t *testing.T) {
	assert.False(t, ShouldRetry(nil, 0))
}

func TestShouldRetry_MaxAttemptsExceeded(t *testing.T) {
	err := errors.New("connection refused")
	assert.False(t, ShouldRetry(err, 3))
	assert.False(t, ShouldRetry(err, 4))
}
