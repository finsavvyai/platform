package opa

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/cache"
)

// OPAClient provides a client for interacting with OPA
type OPAClient struct {
	baseURL    string
	httpClient *http.Client
	redis      *redis.Client
	logger     *logrus.Logger
	cache      *cache.RedisCache
}

// PolicyEvaluationRequest represents a policy evaluation request
type PolicyEvaluationRequest struct {
	Input    map[string]interface{} `json:"input"`
	Policy   string                 `json:"policy,omitempty"`
	Rule     string                 `json:"rule,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// PolicyEvaluationResponse represents a response from OPA
type PolicyEvaluationResponse struct {
	Result   interface{}            `json:"result"`
	Decision bool                   `json:"decision"`
	Reason   string                 `json:"reason,omitempty"`
	Metrics  map[string]interface{} `json:"metrics,omitempty"`
}

// DecisionCacheKey represents a cached decision
type DecisionCacheKey struct {
	PolicyID  string                 `json:"policy_id"`
	InputHash string                 `json:"input_hash"`
	Context   map[string]interface{} `json:"context"`
}

// DecisionCacheValue represents a cached decision value
type DecisionCacheValue struct {
	Decision      bool                   `json:"decision"`
	Reason        string                 `json:"reason"`
	Result        interface{}            `json:"result"`
	ExecutionTime time.Duration          `json:"execution_time"`
	CachedAt      time.Time              `json:"cached_at"`
	TTL           time.Duration          `json:"ttl"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// OPAConfig holds configuration for the OPA client
type OPAConfig struct {
	BaseURL       string        `json:"base_url"`
	Timeout       time.Duration `json:"timeout"`
	CacheEnabled  bool          `json:"cache_enabled"`
	CacheTTL      time.Duration `json:"cache_ttl"`
	RetryAttempts int           `json:"retry_attempts"`
	RetryDelay    time.Duration `json:"retry_delay"`
	EnableMetrics bool          `json:"enable_metrics"`
	LogLevel      string        `json:"log_level"`
}

// DefaultOPAConfig returns default configuration
func DefaultOPAConfig() OPAConfig {
	return OPAConfig{
		BaseURL:       "http://localhost:8181",
		Timeout:       5 * time.Second,
		CacheEnabled:  true,
		CacheTTL:      30 * time.Second,
		RetryAttempts: 3,
		RetryDelay:    100 * time.Millisecond,
		EnableMetrics: true,
		LogLevel:      "info",
	}
}

// NewOPAClient creates a new OPA client
func NewOPAClient(config OPAConfig, redisClient *redis.Client, logger *logrus.Logger) (*OPAClient, error) {
	if logger == nil {
		logger = logrus.New()
	}

	// Parse log level
	level, err := logrus.ParseLevel(config.LogLevel)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	// Create HTTP client
	httpClient := &http.Client{
		Timeout: config.Timeout,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	// Create cache instance
	var cacheInstance *cache.RedisCache
	if config.CacheEnabled && redisClient != nil {
		cacheInstance = cache.NewRedisCache(redisClient, logger)
	}

	client := &OPAClient{
		baseURL:    config.BaseURL,
		httpClient: httpClient,
		redis:      redisClient,
		logger:     logger,
		cache:      cacheInstance,
	}

	return client, nil
}

// EvaluatePolicy evaluates a policy with the given input
func (c *OPAClient) EvaluatePolicy(ctx context.Context, policyPath string, input map[string]interface{}) (*PolicyEvaluationResponse, error) {
	startTime := time.Now()

	// Generate cache key
	if c.cache != nil {
		cacheKey := c.generateCacheKey(policyPath, input)
		if cached, found := c.getCachedDecision(ctx, cacheKey); found {
			c.logger.WithFields(logrus.Fields{
				"policy":  policyPath,
				"cached":  true,
				"latency": time.Since(startTime),
			}).Debug("Policy evaluation served from cache")
			return cached, nil
		}
	}

	// Prepare request
	req := &PolicyEvaluationRequest{
		Input:  input,
		Policy: policyPath,
	}

	// Make request to OPA
	resp, err := c.evaluateWithRetry(ctx, policyPath, req)
	if err != nil {
		return nil, fmt.Errorf("policy evaluation failed: %w", err)
	}

	// Cache the result
	if c.cache != nil {
		cacheKey := c.generateCacheKey(policyPath, input)
		cacheValue := &DecisionCacheValue{
			Decision:      resp.Decision,
			Reason:        resp.Reason,
			Result:        resp.Result,
			ExecutionTime: time.Since(startTime),
			CachedAt:      time.Now(),
			TTL:           30 * time.Second,
			Metadata:      resp.Metrics,
		}
		c.cacheDecision(ctx, cacheKey, cacheValue)
	}

	// Log metrics
	executionTime := time.Since(startTime)
	c.logger.WithFields(logrus.Fields{
		"policy":         policyPath,
		"decision":       resp.Decision,
		"execution_time": executionTime,
		"cached":         false,
	}).Info("Policy evaluation completed")

	return resp, nil
}

// EvaluateDataPolicy evaluates a data access policy
func (c *OPAClient) EvaluateDataPolicy(ctx context.Context, tenantID, userID uuid.UUID, action, resource string, data interface{}) (*PolicyEvaluationResponse, error) {
	input := map[string]interface{}{
		"tenant_id":  tenantID.String(),
		"user_id":    userID.String(),
		"action":     action,
		"resource":   resource,
		"data":       data,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
		"request_id": uuid.New().String(),
	}

	return c.EvaluatePolicy(ctx, "sdlc.data.access", input)
}

// EvaluateAuthPolicy evaluates an authentication policy
func (c *OPAClient) EvaluateAuthPolicy(ctx context.Context, authContext map[string]interface{}) (*PolicyEvaluationResponse, error) {
	input := map[string]interface{}{
		"authentication": authContext,
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
		"request_id":     uuid.New().String(),
	}

	return c.EvaluatePolicy(ctx, "sdlc.auth.policy", input)
}

// EvaluateDLPPolicy evaluates a DLP policy
func (c *OPAClient) EvaluateDLPPolicy(ctx context.Context, content string, userContext map[string]interface{}) (*PolicyEvaluationResponse, error) {
	input := map[string]interface{}{
		"content":     content,
		"user":        userContext,
		"dlp_scanned": false, // Will be updated by DLP service
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"request_id":  uuid.New().String(),
	}

	return c.EvaluatePolicy(ctx, "sdlc.dlp.policy", input)
}

// EvaluateResourcePolicy evaluates a resource access policy
func (c *OPAClient) EvaluateResourcePolicy(ctx context.Context, policy *models.Policy, input map[string]interface{}) (*PolicyEvaluationResponse, error) {
	// Add policy-specific context
	policyInput := map[string]interface{}{
		"policy_id":      policy.ID.String(),
		"policy_version": policy.Version,
		"policy_type":    string(policy.Type),
		"tenant_id":      policy.TenantID.String(),
		"input":          input,
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
		"request_id":     uuid.New().String(),
	}

	// Use the policy's rego content
	return c.evaluateRawPolicy(ctx, policy.RegoPolicy, policyInput)
}

// BatchEvaluatePolicies evaluates multiple policies in parallel
func (c *OPAClient) BatchEvaluatePolicies(ctx context.Context, evaluations []BatchEvaluation) ([]*PolicyEvaluationResponse, error) {
	type result struct {
		index int
		resp  *PolicyEvaluationResponse
		err   error
	}

	results := make(chan result, len(evaluations))

	// Evaluate policies in parallel
	for i, eval := range evaluations {
		go func(idx int, evaluation BatchEvaluation) {
			resp, err := c.EvaluatePolicy(ctx, evaluation.PolicyPath, evaluation.Input)
			results <- result{index: idx, resp: resp, err: err}
		}(i, eval)
	}

	// Collect results
	responses := make([]*PolicyEvaluationResponse, len(evaluations))
	for i := 0; i < len(evaluations); i++ {
		res := <-results
		if res.err != nil {
			return nil, res.err
		}
		responses[res.index] = res.resp
	}

	return responses, nil
}

// BatchEvaluation represents a single policy evaluation in a batch
type BatchEvaluation struct {
	PolicyPath string                 `json:"policy_path"`
	Input      map[string]interface{} `json:"input"`
}

// ListPolicies returns available policies from OPA
func (c *OPAClient) ListPolicies(ctx context.Context) ([]string, error) {
	url := fmt.Sprintf("%s/v1/data", c.baseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list policies: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OPA returned status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	var policies []string
	if data, ok := result["result"].(map[string]interface{}); ok {
		for key := range data {
			policies = append(policies, key)
		}
	}

	return policies, nil
}

// GetPolicyInfo returns information about a specific policy
func (c *OPAClient) GetPolicyInfo(ctx context.Context, policyPath string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/v1/data/%s", c.baseURL, policyPath)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get policy info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OPA returned status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result, nil
}

// Cache management methods

func (c *OPAClient) generateCacheKey(policyPath string, input map[string]interface{}) string {
	inputBytes, _ := json.Marshal(input)
	inputHash := hashString(string(inputBytes))
	return fmt.Sprintf("opa:decision:%s:%s", policyPath, inputHash)
}

func (c *OPAClient) getCachedDecision(ctx context.Context, key string) (*PolicyEvaluationResponse, bool) {
	if c.cache == nil {
		return nil, false
	}

	data, err := c.redis.Get(ctx, key).Result()
	if err != nil {
		if err != redis.Nil {
			c.logger.WithError(err).Error("Failed to get cached decision")
		}
		return nil, false
	}

	var cacheValue DecisionCacheValue
	if err := json.Unmarshal([]byte(data), &cacheValue); err != nil {
		c.logger.WithError(err).Error("Failed to unmarshal cached decision")
		return nil, false
	}

	// Check if cache is still valid
	if time.Since(cacheValue.CachedAt) > cacheValue.TTL {
		c.redis.Del(ctx, key)
		return nil, false
	}

	return &PolicyEvaluationResponse{
		Decision: cacheValue.Decision,
		Reason:   cacheValue.Reason,
		Result:   cacheValue.Result,
		Metrics:  cacheValue.Metadata,
	}, true
}

func (c *OPAClient) cacheDecision(ctx context.Context, key string, value *DecisionCacheValue) {
	if c.cache == nil {
		return
	}

	data, err := json.Marshal(value)
	if err != nil {
		c.logger.WithError(err).Error("Failed to marshal decision for caching")
		return
	}

	if err := c.redis.Set(ctx, key, data, value.TTL).Err(); err != nil {
		c.logger.WithError(err).Error("Failed to cache decision")
	}
}

// Helper methods

func (c *OPAClient) evaluateWithRetry(ctx context.Context, policyPath string, req *PolicyEvaluationRequest) (*PolicyEvaluationResponse, error) {
	var lastErr error

	for attempt := 0; attempt <= 3; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt) * 100 * time.Millisecond):
			}
		}

		resp, err := c.evaluateRawPolicy(ctx, policyPath, req.Input)
		if err == nil {
			return resp, nil
		}

		lastErr = err
		c.logger.WithFields(logrus.Fields{
			"policy":  policyPath,
			"attempt": attempt + 1,
			"error":   err.Error(),
		}).Warn("Policy evaluation failed, retrying")
	}

	return nil, fmt.Errorf("all retry attempts failed: %w", lastErr)
}

func (c *OPAClient) evaluateRawPolicy(ctx context.Context, policyPath string, input map[string]interface{}) (*PolicyEvaluationResponse, error) {
	url := fmt.Sprintf("%s/v1/data/%s", c.baseURL, policyPath)

	reqBody := map[string]interface{}{
		"input": input,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to evaluate policy: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OPA returned status %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Extract decision and result
	decision := false
	if resultVal, ok := result["result"]; ok {
		if resultMap, ok := resultVal.(map[string]interface{}); ok {
			if allowVal, ok := resultMap["allow"].(bool); ok {
				decision = allowVal
			}
		}
	}

	// Extract reason if available
	reason := ""
	if resultMap, ok := result["result"].(map[string]interface{}); ok {
		if reasons, ok := resultMap["decision_reason"].([]interface{}); ok && len(reasons) > 0 {
			if reasonStr, ok := reasons[0].(string); ok {
				reason = reasonStr
			}
		}
	}

	return &PolicyEvaluationResponse{
		Result:   result["result"],
		Decision: decision,
		Reason:   reason,
	}, nil
}

func hashString(s string) string {
	// Simple hash function for cache keys
	// In production, you might want to use a more sophisticated hash
	hash := 5381
	for _, c := range s {
		hash = ((hash << 5) + hash) + int(c)
	}
	return fmt.Sprintf("%x", hash)
}

// Health check
func (c *OPAClient) HealthCheck(ctx context.Context) error {
	url := fmt.Sprintf("%s/health", c.baseURL)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("OPA health check failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("OPA health check returned status %d", resp.StatusCode)
	}

	return nil
}
