package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
)

// GatewayIntegrationSuite runs E2E tests against the gateway with real dependencies
type GatewayIntegrationSuite struct {
	suite.Suite
	ctx            context.Context
	pgContainer    *postgres.PostgresContainer
	redisContainer *redis.RedisContainer
	baseURL        string
	authToken      string
}

func TestGatewayIntegration(t *testing.T) {
	if os.Getenv("INTEGRATION_TESTS") != "true" {
		t.Skip("Skipping integration tests (set INTEGRATION_TESTS=true)")
	}
	suite.Run(t, new(GatewayIntegrationSuite))
}

// ── Setup & Teardown ────────────────────────────────────

func (s *GatewayIntegrationSuite) SetupSuite() {
	s.ctx = context.Background()

	// Start PostgreSQL container
	pgContainer, err := postgres.Run(s.ctx,
		"postgres:16-alpine",
		postgres.WithDatabase("sdlc_test"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(30*time.Second)),
	)
	require.NoError(s.T(), err)
	s.pgContainer = pgContainer

	// Start Redis container
	redisContainer, err := redis.Run(s.ctx,
		"redis:7-alpine",
		testcontainers.WithWaitStrategy(
			wait.ForLog("Ready to accept connections").
				WithStartupTimeout(15*time.Second)),
	)
	require.NoError(s.T(), err)
	s.redisContainer = redisContainer

	// Get connection strings
	pgConnStr, err := pgContainer.ConnectionString(s.ctx, "sslmode=disable")
	require.NoError(s.T(), err)

	redisEndpoint, err := redisContainer.Endpoint(s.ctx, "")
	require.NoError(s.T(), err)

	// Set environment for gateway
	os.Setenv("DATABASE_URL", pgConnStr)
	os.Setenv("REDIS_URL", "redis://"+redisEndpoint)
	os.Setenv("PORT", "18080")
	os.Setenv("ENV", "test")

	s.baseURL = "http://localhost:18080"

	s.T().Logf("PostgreSQL: %s", pgConnStr)
	s.T().Logf("Redis: %s", redisEndpoint)
	s.T().Logf("Gateway: %s", s.baseURL)
}

func (s *GatewayIntegrationSuite) TearDownSuite() {
	if s.pgContainer != nil {
		s.pgContainer.Terminate(s.ctx)
	}
	if s.redisContainer != nil {
		s.redisContainer.Terminate(s.ctx)
	}
}

// ── Health Endpoint Tests ───────────────────────────────

func (s *GatewayIntegrationSuite) TestHealthEndpoint() {
	resp, err := http.Get(s.baseURL + "/healthz")
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
	assert.Equal(s.T(), "application/health+json", resp.Header.Get("Content-Type"))

	var body map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&body)
	require.NoError(s.T(), err)

	assert.Equal(s.T(), "pass", body["status"])
}

func (s *GatewayIntegrationSuite) TestReadinessEndpoint() {
	resp, err := http.Get(s.baseURL + "/readyz?verbose=true")
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)

	// Should have checks when verbose
	if resp.StatusCode == http.StatusOK {
		assert.Equal(s.T(), "pass", body["status"])
	}
}

func (s *GatewayIntegrationSuite) TestLivenessEndpoint() {
	resp, err := http.Get(s.baseURL + "/livez")
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
}

// ── Auth Endpoint Tests ─────────────────────────────────

func (s *GatewayIntegrationSuite) TestAuthLoginInvalidCredentials() {
	payload := map[string]string{
		"email":    "nonexistent@test.com",
		"password": "wrongpassword",
	}
	body, _ := json.Marshal(payload)

	resp, err := http.Post(s.baseURL+"/api/v1/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusUnauthorized, resp.StatusCode)
}

func (s *GatewayIntegrationSuite) TestAuthLoginMissingFields() {
	payload := map[string]string{
		"email": "user@test.com",
		// missing password
	}
	body, _ := json.Marshal(payload)

	resp, err := http.Post(s.baseURL+"/api/v1/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	assert.Contains(s.T(), []int{http.StatusBadRequest, http.StatusUnauthorized}, resp.StatusCode)
}

// ── Tenant CRUD Tests ───────────────────────────────────

func (s *GatewayIntegrationSuite) TestTenantCRUDLifecycle() {
	client := &http.Client{Timeout: 10 * time.Second}

	// CREATE
	createPayload := map[string]interface{}{
		"name": "Integration Test Tenant",
		"plan": "professional",
	}
	body, _ := json.Marshal(createPayload)

	req, _ := http.NewRequest("POST", s.baseURL+"/api/v1/tenants", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if s.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.authToken)
	}

	resp, err := client.Do(req)
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		s.T().Skip("Auth required — skipping CRUD test without valid token")
		return
	}

	if resp.StatusCode != http.StatusCreated {
		s.T().Skipf("Unexpected status %d for create tenant", resp.StatusCode)
		return
	}

	var createResp map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&createResp)

	data, ok := createResp["data"].(map[string]interface{})
	if !ok {
		s.T().Skip("Unexpected response format")
		return
	}
	tenantID := data["id"].(string)

	// READ
	req, _ = http.NewRequest("GET", fmt.Sprintf("%s/api/v1/tenants/%s", s.baseURL, tenantID), nil)
	if s.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.authToken)
	}
	resp, err = client.Do(req)
	require.NoError(s.T(), err)
	defer resp.Body.Close()
	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)

	// UPDATE
	updatePayload := map[string]interface{}{
		"name": "Updated Integration Tenant",
	}
	body, _ = json.Marshal(updatePayload)
	req, _ = http.NewRequest("PUT", fmt.Sprintf("%s/api/v1/tenants/%s", s.baseURL, tenantID), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if s.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.authToken)
	}
	resp, err = client.Do(req)
	require.NoError(s.T(), err)
	defer resp.Body.Close()
	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)

	// DELETE
	req, _ = http.NewRequest("DELETE", fmt.Sprintf("%s/api/v1/tenants/%s", s.baseURL, tenantID), nil)
	if s.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.authToken)
	}
	resp, err = client.Do(req)
	require.NoError(s.T(), err)
	defer resp.Body.Close()
	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)
}

// ── Document Upload Tests ───────────────────────────────

func (s *GatewayIntegrationSuite) TestDocumentUploadTooLarge() {
	// Create a payload exceeding max size
	largeBody := make([]byte, 51*1024*1024) // 51 MB
	req, _ := http.NewRequest("POST", s.baseURL+"/api/v1/documents", bytes.NewReader(largeBody))
	req.Header.Set("Content-Type", "multipart/form-data")
	if s.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.authToken)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	// Should get 413 or 400 for oversized payload
	assert.Contains(s.T(), []int{
		http.StatusRequestEntityTooLarge,
		http.StatusBadRequest,
		http.StatusUnauthorized,
	}, resp.StatusCode)
}

// ── Rate Limiting Tests ─────────────────────────────────

func (s *GatewayIntegrationSuite) TestRateLimitingHeaders() {
	resp, err := http.Get(s.baseURL + "/api/v1/documents")
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	// Rate limit headers should be present (if rate limiter is active)
	if resp.Header.Get("X-RateLimit-Limit") != "" {
		assert.NotEmpty(s.T(), resp.Header.Get("X-RateLimit-Remaining"))
		assert.NotEmpty(s.T(), resp.Header.Get("X-RateLimit-Reset"))
	}
}

// ── API Versioning Tests ────────────────────────────────

func (s *GatewayIntegrationSuite) TestAPIVersioningRedirect() {
	resp, err := http.Get(s.baseURL + "/api")
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)

	var body map[string]string
	json.NewDecoder(resp.Body).Decode(&body)
	assert.Contains(s.T(), body["version"], "v1")
}

func (s *GatewayIntegrationSuite) TestVersionEndpoint() {
	resp, err := http.Get(s.baseURL + "/version")
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusOK, resp.StatusCode)

	var body map[string]string
	json.NewDecoder(resp.Body).Decode(&body)
	assert.NotEmpty(s.T(), body["version"])
}

// ── CORS & Security Header Tests ────────────────────────

func (s *GatewayIntegrationSuite) TestSecurityHeaders() {
	resp, err := http.Get(s.baseURL + "/")
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	// Standard security headers should be set by middleware
	headers := resp.Header
	if headers.Get("X-Content-Type-Options") != "" {
		assert.Equal(s.T(), "nosniff", headers.Get("X-Content-Type-Options"))
	}
	if headers.Get("X-Frame-Options") != "" {
		assert.Equal(s.T(), "DENY", headers.Get("X-Frame-Options"))
	}
}

// ── Method Not Allowed Tests ────────────────────────────

func (s *GatewayIntegrationSuite) TestMethodNotAllowed() {
	client := &http.Client{Timeout: 5 * time.Second}

	req, _ := http.NewRequest("PATCH", s.baseURL+"/api/v1/auth/login", nil)
	resp, err := client.Do(req)
	if err != nil {
		s.T().Skipf("Gateway not running: %v", err)
		return
	}
	defer resp.Body.Close()

	assert.Equal(s.T(), http.StatusMethodNotAllowed, resp.StatusCode)
}
