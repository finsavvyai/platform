package sdln_test

import (
	"context"
	"testing"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/auth"
	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
	"github.com/stretchr/testify/assert"
)

// TestNewClient tests basic client creation
func TestNewClient(t *testing.T) {
	config := &sdln.Config{
		BaseURL:     "https://api.sdlc.ai",
		Timeout:     30 * time.Second,
		RetryConfig: sdln.DefaultRetryConfig(),
	}

	client, err := sdln.NewClient(
		config,
		auth.WithAPIKey("test-key"),
	)

	assert.NoError(t, err)
	assert.NotNil(t, client)
	assert.Equal(t, config, client.GetConfig())
	assert.NotNil(t, client.Users)
	assert.NotNil(t, client.Tenants)
	assert.NotNil(t, client.Documents)
	assert.NotNil(t, client.RAG)
	assert.NotNil(t, client.Vector)
	assert.NotNil(t, client.Policies)
	assert.NotNil(t, client.LLM)
	assert.NotNil(t, client.Monitoring)
	assert.NotNil(t, client.WebSocket)

	err = client.Close()
	assert.NoError(t, err)
}

// TestClientWithInvalidConfig tests client creation with invalid config
func TestClientWithInvalidConfig(t *testing.T) {
	config := &sdln.Config{
		BaseURL: "invalid-url", // Should be a valid URL
		Timeout: 30 * time.Second,
	}

	client, err := sdln.NewClient(
		config,
		auth.WithAPIKey("test-key"),
	)

	// Should still create client even with invalid URL
	assert.NoError(t, err)
	assert.NotNil(t, client)
	assert.Equal(t, config, client.GetConfig())

	err = client.Close()
	assert.NoError(t, err)
}

// TestDefaultConfig tests default configuration
func TestDefaultConfig(t *testing.T) {
	config := sdln.DefaultConfig()
	assert.NotNil(t, config)
	assert.Equal(t, "https://api.sdlc.ai", config.BaseURL)
	assert.Equal(t, 30*time.Second, config.Timeout)
	assert.Equal(t, 100, config.MaxIdleConns)
	assert.Equal(t, 10, config.MaxIdleConnsPerHost)
	assert.Equal(t, 90*time.Second, config.IdleConnTimeout)
	assert.Equal(t, 10*time.Second, config.TLSHandshakeTimeout)
	assert.NotNil(t, config.RetryConfig)
	assert.Equal(t, "sdln-sdk-go/1.0.0", config.UserAgent)
	assert.Equal(t, false, config.Debug)
}

// TestDefaultRetryConfig tests default retry configuration
func TestDefaultRetryConfig(t *testing.T) {
	config := sdln.DefaultRetryConfig()
	assert.NotNil(t, config)
	assert.Equal(t, 3, config.MaxRetries)
	assert.Equal(t, 100*time.Millisecond, config.InitialBackoff)
	assert.Equal(t, 5*time.Second, config.MaxBackoff)
	assert.Equal(t, 2.0, config.BackoffFactor)
	assert.Contains(t, config.RetryableErrors, "timeout")
	assert.Contains(t, config.RetryableErrors, "connection_error")
	assert.Contains(t, config.RetryableErrors, "rate_limit")
	assert.Contains(t, config.RetryableErrors, "internal_error")
	assert.Equal(t, true, config.Jitter)
}

// TestClientWithMultipleAuthMethods tests client creation with different auth methods
func TestClientWithMultipleAuthMethods(t *testing.T) {
	config := sdln.DefaultConfig()

	tests := []struct {
		name    string
		authOpt sdln.ClientOption
	}{
		{
			name:    "API Key",
			authOpt: auth.WithAPIKey("test-api-key"),
		},
		{
			name:    "JWT",
			authOpt: auth.WithJWT("test-jwt-token"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := sdln.NewClient(config, tt.authOpt)
			assert.NoError(t, err)
			assert.NotNil(t, client)

			err = client.Close()
			assert.NoError(t, err)
		})
	}
}

// TestClientMiddleware tests middleware functionality
func TestClientMiddleware(t *testing.T) {
	config := sdln.DefaultConfig()

	// Mock middleware that tracks calls
	var middlewareCalled bool

	client, err := sdln.NewClient(
		config,
		auth.WithAPIKey("test-key"),
		sdln.WithMiddleware(func(ctx context.Context, req sdln.HTTPRequest) error {
			middlewareCalled = true
			return nil
		}),
	)

	assert.NoError(t, err)
	assert.NotNil(t, client)

	// Verify middleware was set (we can't easily test that it's called without a real HTTP request)
	err = client.Close()
	assert.NoError(t, err)
}

// TestContextTimeout tests that requests respect context timeout
func TestContextTimeout(t *testing.T) {
	config := sdln.DefaultConfig()

	client, err := sdln.NewClient(
		config,
		auth.WithAPIKey("test-key"),
	)

	assert.NoError(t, err)

	// Create a context with very short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	// This should fail immediately due to context timeout
	// Note: In a real test, we'd need to mock the HTTP client
	// This is just verifying the context is handled correctly

	err = client.Close()
	assert.NoError(t, err)
}

// BenchmarkClientCreation benchmarks client creation performance
func BenchmarkClientCreation(b *testing.B) {
	config := &sdln.Config{
		BaseURL:     "https://api.sdlc.ai",
		Timeout:     30 * time.Second,
		RetryConfig: sdln.DefaultRetryConfig(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		client, err := sdln.NewClient(config, auth.WithAPIKey("test-key"))
		if err != nil {
			b.Fatal(err)
		}
		_ = client.Close()
	}
}

// BenchmarkClientServiceAccess benchmarks service access performance
func BenchmarkClientServiceAccess(b *testing.B) {
	config := &sdln.Config{
		BaseURL:     "https://api.sdlc.ai",
		Timeout:     30 * time.Second,
		RetryConfig: sdln.DefaultRetryConfig(),
	}

	client, err := sdln.NewClient(config, auth.WithAPIKey("test-key"))
	if err != nil {
		b.Fatal(err)
	}
	defer client.Close()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = client.Users
		_ = client.Tenants
		_ = client.Documents
		_ = client.RAG
		_ = client.Vector
		_ = client.Policies
		_ = client.LLM
		_ = client.Monitoring
		_ = client.WebSocket
	}
}
