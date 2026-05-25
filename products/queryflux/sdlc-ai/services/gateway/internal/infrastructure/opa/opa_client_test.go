package opa

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
)

// MockRedisClient is a mock for Redis client
type MockRedisClient struct {
	mock.Mock
}

func (m *MockRedisClient) Get(ctx context.Context, key string) *redis.StringCmd {
	args := m.Called(ctx, key)
	cmd := redis.NewStringCmd(ctx)
	if args.Get(0) != nil {
		cmd.SetVal(args.String(0))
	}
	if args.Get(1) != nil {
		cmd.SetErr(args.Error(1))
	}
	return cmd
}

func (m *MockRedisClient) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.StatusCmd {
	args := m.Called(ctx, key, value, expiration)
	cmd := redis.NewStatusCmd(ctx)
	if args.Get(0) != nil {
		cmd.SetVal(args.String(0))
	}
	if args.Get(1) != nil {
		cmd.SetErr(args.Error(1))
	}
	return cmd
}

func (m *MockRedisClient) Del(ctx context.Context, keys ...string) *redis.IntCmd {
	args := m.Called(ctx, keys)
	cmd := redis.NewIntCmd(ctx)
	if args.Get(0) != nil {
		cmd.SetVal(args.Int(0))
	}
	if args.Get(1) != nil {
		cmd.SetErr(args.Error(1))
	}
	return cmd
}

// MockRoundTripper is a mock HTTP transport
type MockRoundTripper struct {
	mock.Mock
}

func (m *MockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	args := m.Called(req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*http.Response), args.Error(1)
}

func TestNewOPAClient(t *testing.T) {
	config := DefaultOPAConfig()
	logger := logrus.New()

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)
	require.NotNil(t, client)

	assert.Equal(t, config.BaseURL, client.baseURL)
	assert.NotNil(t, client.httpClient)
	assert.NotNil(t, client.logger)
}

func TestOPAClient_EvaluatePolicy(t *testing.T) {
	// Create mock HTTP transport
	mockTransport := &MockRoundTripper{}

	// Mock OPA response
	opaResponse := map[string]interface{}{
		"result": map[string]interface{}{
			"allow":           true,
			"decision_reason": []string{"Access granted"},
		},
	}

	responseBody, _ := json.Marshal(opaResponse)

	mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
		Header:     make(http.Header),
	}, nil)

	// Create client with mock transport
	config := DefaultOPAConfig()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Reduce noise in tests

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)

	client.httpClient.Transport = mockTransport

	// Test policy evaluation
	ctx := context.Background()
	input := map[string]interface{}{
		"user":     "test-user",
		"action":   "read",
		"resource": "test-resource",
	}

	resp, err := client.EvaluatePolicy(ctx, "sdlc.test.policy", input)
	require.NoError(t, err)
	require.NotNil(t, resp)

	assert.True(t, resp.Decision)
	assert.Equal(t, "Access granted", resp.Reason)
	mockTransport.AssertExpectations(t)
}

func TestOPAClient_EvaluateDataPolicy(t *testing.T) {
	// Create mock HTTP transport
	mockTransport := &MockRoundTripper{}

	opaResponse := map[string]interface{}{
		"result": map[string]interface{}{
			"allow": true,
		},
	}

	responseBody, _ := json.Marshal(opaResponse)

	mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
		Header:     make(http.Header),
	}, nil)

	config := DefaultOPAConfig()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)

	client.httpClient.Transport = mockTransport

	// Test data policy evaluation
	ctx := context.Background()
	tenantID := uuid.New()
	userID := uuid.New()

	resp, err := client.EvaluateDataPolicy(ctx, tenantID, userID, "read", "documents", map[string]interface{}{
		"id": "doc-123",
	})
	require.NoError(t, err)
	require.NotNil(t, resp)

	assert.True(t, resp.Decision)
	mockTransport.AssertExpectations(t)
}

func TestOPAClient_EvaluateDLPPolicy(t *testing.T) {
	// Create mock HTTP transport
	mockTransport := &MockRoundTripper{}

	opaResponse := map[string]interface{}{
		"result": map[string]interface{}{
			"allow":           false,
			"decision_reason": []string{"Content blocked: contains high-risk PII"},
		},
	}

	responseBody, _ := json.Marshal(opaResponse)

	mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
		Header:     make(http.Header),
	}, nil)

	config := DefaultOPAConfig()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)

	client.httpClient.Transport = mockTransport

	// Test DLP policy evaluation
	ctx := context.Background()
	content := "User's SSN is 123-45-6789"
	userContext := map[string]interface{}{
		"user_id": uuid.New().String(),
		"role":    "user",
	}

	resp, err := client.EvaluateDLPPolicy(ctx, content, userContext)
	require.NoError(t, err)
	require.NotNil(t, resp)

	assert.False(t, resp.Decision)
	assert.Contains(t, resp.Reason, "high-risk PII")
	mockTransport.AssertExpectations(t)
}

func TestOPAClient_BatchEvaluatePolicies(t *testing.T) {
	// Create mock HTTP transport
	mockTransport := &MockRoundTripper{}

	opaResponse := map[string]interface{}{
		"result": map[string]interface{}{
			"allow": true,
		},
	}

	responseBody, _ := json.Marshal(opaResponse)

	mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
		Header:     make(http.Header),
	}, nil).Times(3)

	config := DefaultOPAConfig()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)

	client.httpClient.Transport = mockTransport

	// Test batch evaluation
	ctx := context.Background()
	evaluations := []BatchEvaluation{
		{
			PolicyPath: "sdlc.test.policy1",
			Input:      map[string]interface{}{"action": "read"},
		},
		{
			PolicyPath: "sdlc.test.policy2",
			Input:      map[string]interface{}{"action": "write"},
		},
		{
			PolicyPath: "sdlc.test.policy3",
			Input:      map[string]interface{}{"action": "delete"},
		},
	}

	responses, err := client.BatchEvaluatePolicies(ctx, evaluations)
	require.NoError(t, err)
	require.Len(t, responses, 3)

	for _, resp := range responses {
		assert.True(t, resp.Decision)
	}

	mockTransport.AssertExpectations(t)
}

func TestOPAClient_Caching(t *testing.T) {
	// Create mock Redis client
	mockRedis := &MockRedisClient{}

	// Mock cache miss
	mockRedis.On("Get", mock.Anything, mock.AnythingOfType("string")).Return("", redis.Nil)
	mockRedis.On("Set", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("time.Duration")).Return("OK", nil)

	// Create mock HTTP transport
	mockTransport := &MockRoundTripper{}

	opaResponse := map[string]interface{}{
		"result": map[string]interface{}{
			"allow": true,
		},
	}

	responseBody, _ := json.Marshal(opaResponse)

	mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
		Header:     make(http.Header),
	}, nil)

	config := DefaultOPAConfig()
	config.CacheEnabled = true
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)

	client.httpClient.Transport = mockTransport
	client.redis = mockRedis

	// Test caching
	ctx := context.Background()
	input := map[string]interface{}{
		"user":   "test-user",
		"action": "read",
	}

	resp, err := client.EvaluatePolicy(ctx, "sdlc.test.policy", input)
	require.NoError(t, err)
	require.NotNil(t, resp)

	assert.True(t, resp.Decision)
	mockRedis.AssertExpectations(t)
	mockTransport.AssertExpectations(t)
}

func TestOPAClient_HealthCheck(t *testing.T) {
	// Create mock HTTP transport
	mockTransport := &MockRoundTripper{}

	mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader("OK")),
		Header:     make(http.Header),
	}, nil)

	config := DefaultOPAConfig()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)

	client.httpClient.Transport = mockTransport

	// Test health check
	ctx := context.Background()
	err = client.HealthCheck(ctx)
	require.NoError(t, err)

	mockTransport.AssertExpectations(t)
}

func TestOPAClient_HealthCheck_Failure(t *testing.T) {
	// Create mock HTTP transport
	mockTransport := &MockRoundTripper{}

	mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(&http.Response{
		StatusCode: http.StatusServiceUnavailable,
		Body:       io.NopCloser(strings.NewReader("Service Unavailable")),
		Header:     make(http.Header),
	}, nil)

	config := DefaultOPAConfig()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)

	client.httpClient.Transport = mockTransport

	// Test health check failure
	ctx := context.Background()
	err = client.HealthCheck(ctx)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "status 503")

	mockTransport.AssertExpectations(t)
}

func TestOPAClient_EvaluateResourcePolicy(t *testing.T) {
	// Create mock HTTP transport
	mockTransport := &MockRoundTripper{}

	opaResponse := map[string]interface{}{
		"result": map[string]interface{}{
			"allow":           true,
			"decision_reason": []string{"Resource access granted"},
		},
	}

	responseBody, _ := json.Marshal(opaResponse)

	mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
		Header:     make(http.Header),
	}, nil)

	config := DefaultOPAConfig()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)

	client.httpClient.Transport = mockTransport

	// Test resource policy evaluation
	ctx := context.Background()
	policy := &models.Policy{
		ID:       uuid.New(),
		TenantID: uuid.New(),
		Name:     "Test Policy",
		Type:     models.PolicyTypeData,
		RegoPolicy: `package test.policy
default allow = false
allow {
    input.action == "read"
}`,
		Version: 1,
	}

	input := map[string]interface{}{
		"action": "read",
		"user":   "test-user",
	}

	resp, err := client.EvaluateResourcePolicy(ctx, policy, input)
	require.NoError(t, err)
	require.NotNil(t, resp)

	assert.True(t, resp.Decision)
	assert.Equal(t, "Resource access granted", resp.Reason)
	mockTransport.AssertExpectations(t)
}

func TestOPAClient_ListPolicies(t *testing.T) {
	// Create mock HTTP transport
	mockTransport := &MockRoundTripper{}

	opaResponse := map[string]interface{}{
		"result": map[string]interface{}{
			"sdlc": map[string]interface{}{
				"auth": map[string]interface{}{},
				"data": map[string]interface{}{},
				"dlp":  map[string]interface{}{},
			},
		},
	}

	responseBody, _ := json.Marshal(opaResponse)

	mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
		Header:     make(http.Header),
	}, nil)

	config := DefaultOPAConfig()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)

	client.httpClient.Transport = mockTransport

	// Test list policies
	ctx := context.Background()
	policies, err := client.ListPolicies(ctx)
	require.NoError(t, err)
	require.NotNil(t, policies)

	assert.Contains(t, policies, "sdlc")
	mockTransport.AssertExpectations(t)
}

func TestOPAClient_GetPolicyInfo(t *testing.T) {
	// Create mock HTTP transport
	mockTransport := &MockRoundTripper{}

	opaResponse := map[string]interface{}{
		"result": map[string]interface{}{
			"allow": true,
			"rules": []string{"test_rule_1", "test_rule_2"},
		},
	}

	responseBody, _ := json.Marshal(opaResponse)

	mockTransport.On("RoundTrip", mock.AnythingOfType("*http.Request")).Return(&http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(responseBody)),
		Header:     make(http.Header),
	}, nil)

	config := DefaultOPAConfig()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	client, err := NewOPAClient(config, nil, logger)
	require.NoError(t, err)

	client.httpClient.Transport = mockTransport

	// Test get policy info
	ctx := context.Background()
	info, err := client.GetPolicyInfo(ctx, "sdlc.test.policy")
	require.NoError(t, err)
	require.NotNil(t, info)

	assert.Contains(t, info, "result")
	mockTransport.AssertExpectations(t)
}

// Benchmark tests
func BenchmarkOPAClient_EvaluatePolicy(b *testing.B) {
	// This benchmark would require a real OPA instance
	// For now, we'll skip it
	b.Skip("Requires real OPA instance")
}

func BenchmarkOPAClient_BatchEvaluatePolicies(b *testing.B) {
	// This benchmark would require a real OPA instance
	// For now, we'll skip it
	b.Skip("Requires real OPA instance")
}
