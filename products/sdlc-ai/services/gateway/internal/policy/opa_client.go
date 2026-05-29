package policy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// OPAClient represents the OPA client interface
type OPAClient interface {
	EvaluatePolicy(ctx context.Context, input PolicyInput) (*PolicyDecision, error)
	LoadPolicy(ctx context.Context, policy PolicyBundle) error
	TestPolicy(ctx context.Context, policy PolicyBundle, testCases []TestCase) ([]TestResult, error)
	GetPolicyMetrics(ctx context.Context) PolicyMetrics
	Health(ctx context.Context) error
}

// OPAConfig represents OPA configuration
type OPAConfig struct {
	ServerURL     string        `json:"server_url"`
	BundleURL     string        `json:"bundle_url"`
	BundleVersion string        `json:"bundle_version"`
	SigningKey    string        `json:"signing_key"`
	Timeout       time.Duration `json:"timeout"`
	CacheSize     int           `json:"cache_size"`
	CacheTTL      time.Duration `json:"cache_ttl"`
	HotReload     bool          `json:"hot_reload"`
}

// DefaultOPAConfig returns default OPA configuration
func DefaultOPAConfig() OPAConfig {
	return OPAConfig{
		ServerURL:     "http://localhost:8181",
		BundleURL:     "https://bundles.example.com/policies",
		BundleVersion: "latest",
		Timeout:       20 * time.Millisecond,
		CacheSize:     10000,
		CacheTTL:      5 * time.Minute,
		HotReload:     true,
	}
}

// opaClient implements the OPAClient interface
type opaClient struct {
	config     OPAConfig
	httpClient *http.Client
	cache      *DecisionCache
	metrics    *PolicyMetricsCollector
	logger     Logger
}

// NewOPAClient creates a new OPA client
func NewOPAClient(config OPAConfig, logger Logger) OPAClient {
	return &opaClient{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
		cache:   NewDecisionCache(config.CacheSize, config.CacheTTL),
		metrics: NewPolicyMetricsCollector(),
		logger:  logger,
	}
}

// PolicyInput represents the input for policy evaluation
type PolicyInput struct {
	Query     string                 `json:"query"`
	Data      map[string]interface{} `json:"data"`
	TenantID  string                 `json:"tenant_id"`
	UserID    string                 `json:"user_id"`
	RequestID string                 `json:"request_id"`
	Action    string                 `json:"action"`
	Resource  string                 `json:"resource"`
	Context   map[string]interface{} `json:"context"`
}

// CacheKey generates a cache key for the policy input
func (p PolicyInput) CacheKey() string {
	data, _ := json.Marshal(p)
	return fmt.Sprintf("policy:%x", data)
}

// PolicyDecision represents the result of policy evaluation
type PolicyDecision struct {
	Allowed    bool                   `json:"allowed"`
	Reason     string                 `json:"reason"`
	Conditions []Condition            `json:"conditions"`
	AuditLog   AuditEntry             `json:"audit_log"`
	Metrics    DecisionMetrics        `json:"metrics"`
	CacheHit   bool                   `json:"cache_hit"`
	RawOutput  map[string]interface{} `json:"raw_output"`
}

// Condition represents a policy condition
type Condition struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Value       interface{}            `json:"value"`
	Description string                 `json:"description"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// AuditEntry represents an audit log entry
type AuditEntry struct {
	EventID    string                 `json:"event_id"`
	Timestamp  time.Time              `json:"timestamp"`
	TenantID   string                 `json:"tenant_id"`
	UserID     string                 `json:"user_id"`
	Action     string                 `json:"action"`
	Resource   string                 `json:"resource"`
	Decision   string                 `json:"decision"`
	Reason     string                 `json:"reason"`
	InputData  map[string]interface{} `json:"input_data"`
	OutputData map[string]interface{} `json:"output_data"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// DecisionMetrics represents decision metrics
type DecisionMetrics struct {
	ExecutionTimeMs int       `json:"execution_time_ms"`
	PoliciesChecked int       `json:"policies_checked"`
	RulesEvaluated  int       `json:"rules_evaluated"`
	Timestamp       time.Time `json:"timestamp"`
}

// PolicyBundle represents a policy bundle
type PolicyBundle struct {
	Name       string            `json:"name"`
	Version    string            `json:"version"`
	Policies   map[string]string `json:"policies"`   // Rego policies
	Data       map[string]string `json:"data"`       // Policy data
	Signatures []string          `json:"signatures"` // Bundle signatures
	Metadata   map[string]string `json:"metadata"`
	CreatedAt  time.Time         `json:"created_at"`
}

// TestCase represents a policy test case
type TestCase struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Input       PolicyInput    `json:"input"`
	Expected    PolicyDecision `json:"expected"`
	Timeout     time.Duration  `json:"timeout"`
}

// TestResult represents the result of a policy test
type TestResult struct {
	TestCase  TestCase       `json:"test_case"`
	Actual    PolicyDecision `json:"actual"`
	Passed    bool           `json:"passed"`
	Error     string         `json:"error,omitempty"`
	Duration  time.Duration  `json:"duration"`
	Timestamp time.Time      `json:"timestamp"`
}

// PolicyMetrics represents policy engine metrics
type PolicyMetrics struct {
	EvaluationsTotal  int64         `json:"evaluations_total"`
	EvaluationsPerSec float64       `json:"evaluations_per_sec"`
	AvgLatency        time.Duration `json:"avg_latency"`
	P95Latency        time.Duration `json:"p95_latency"`
	CacheHitRate      float64       `json:"cache_hit_rate"`
	ActivePolicies    int           `json:"active_policies"`
	ErrorRate         float64       `json:"error_rate"`
	LastUpdated       time.Time     `json:"last_updated"`
}

// EvaluatePolicy evaluates a policy with the given input
func (c *opaClient) EvaluatePolicy(ctx context.Context, input PolicyInput) (*PolicyDecision, error) {
	startTime := time.Now()

	// Check cache first
	if cached, found := c.cache.Get(input.CacheKey()); found {
		c.metrics.RecordCacheHit()
		cached.CacheHit = true
		return cached, nil
	}

	// Record metrics
	c.metrics.RecordEvaluation()

	// Prepare OPA request
	opaInput := map[string]interface{}{
		"input": input,
	}

	reqBody, err := json.Marshal(opaInput)
	if err != nil {
		c.metrics.RecordError()
		return nil, fmt.Errorf("failed to marshal OPA input: %w", err)
	}

	// Make OPA request
	url := fmt.Sprintf("%s/v1/data%s", c.config.ServerURL, input.Query)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(reqBody))
	if err != nil {
		c.metrics.RecordError()
		return nil, fmt.Errorf("failed to create OPA request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.metrics.RecordError()
		return nil, fmt.Errorf("OPA request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		c.metrics.RecordError()
		return nil, fmt.Errorf("OPA returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse OPA response
	var opaResp struct {
		Result map[string]interface{} `json:"result"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&opaResp); err != nil {
		c.metrics.RecordError()
		return nil, fmt.Errorf("failed to decode OPA response: %w", err)
	}

	// Parse decision
	decision := c.parseDecision(opaResp.Result, input, time.Since(startTime))

	// Cache result
	c.cache.Set(input.CacheKey(), decision, c.config.CacheTTL)

	// Record metrics
	c.metrics.RecordLatency(decision.Metrics.ExecutionTimeMs)

	c.logger.Debug("Policy evaluation completed", map[string]interface{}{
		"tenant_id":   input.TenantID,
		"user_id":     input.UserID,
		"action":      input.Action,
		"decision":    decision.Allowed,
		"duration_ms": decision.Metrics.ExecutionTimeMs,
		"cache_hit":   false,
	})

	return decision, nil
}

// parseDecision parses OPA result into PolicyDecision
func (c *opaClient) parseDecision(result map[string]interface{}, input PolicyInput, duration time.Duration) *PolicyDecision {
	decision := &PolicyDecision{
		Allowed: false,
		Reason:  "Access denied by default policy",
		Metrics: DecisionMetrics{
			ExecutionTimeMs: int(duration.Milliseconds()),
			PoliciesChecked: 1,
			RulesEvaluated:  0,
			Timestamp:       time.Now(),
		},
		RawOutput: result,
		CacheHit:  false,
	}

	// Extract allow/deny decision
	if allow, ok := result["allow"].(bool); ok {
		decision.Allowed = allow
	}

	// Extract reason
	if reason, ok := result["reason"].(string); ok {
		decision.Reason = reason
	}

	// Extract conditions
	if conditions, ok := result["conditions"].([]interface{}); ok {
		for _, cond := range conditions {
			if condMap, ok := cond.(map[string]interface{}); ok {
				condition := Condition{
					Name:        getString(condMap, "name"),
					Type:        getString(condMap, "type"),
					Value:       condMap["value"],
					Description: getString(condMap, "description"),
				}
				if metadata, ok := condMap["metadata"].(map[string]interface{}); ok {
					condition.Metadata = metadata
				}
				decision.Conditions = append(decision.Conditions, condition)
			}
		}
	}

	// Create audit entry
	decision.AuditLog = AuditEntry{
		EventID:    fmt.Sprintf("audit_%d", time.Now().UnixNano()),
		Timestamp:  time.Now(),
		TenantID:   input.TenantID,
		UserID:     input.UserID,
		Action:     input.Action,
		Resource:   input.Resource,
		Decision:   map[bool]string{true: "allow", false: "deny"}[decision.Allowed],
		Reason:     decision.Reason,
		InputData:  map[string]interface{}{"input": input},
		OutputData: map[string]interface{}{"decision": decision.Allowed},
	}

	return decision
}

// LoadPolicy loads a policy bundle into OPA
func (c *opaClient) LoadPolicy(ctx context.Context, policy PolicyBundle) error {
	c.logger.Info("Loading policy bundle", map[string]interface{}{
		"name":    policy.Name,
		"version": policy.Version,
	})

	// TODO: Implement policy bundle loading
	// This would involve:
	// 1. Verifying bundle signatures
	// 2. Extracting policies and data
	// 3. Loading into OPA via /v1/policies endpoint
	// 4. Updating cache and metrics

	return nil
}

// TestPolicy tests a policy with test cases
func (c *opaClient) TestPolicy(ctx context.Context, policy PolicyBundle, testCases []TestCase) ([]TestResult, error) {
	c.logger.Info("Testing policy bundle", map[string]interface{}{
		"name":       policy.Name,
		"version":    policy.Version,
		"test_cases": len(testCases),
	})

	var results []TestResult

	for _, testCase := range testCases {
		startTime := time.Now()

		// Load policy (in real implementation, would load into test OPA instance)
		if err := c.LoadPolicy(ctx, policy); err != nil {
			results = append(results, TestResult{
				TestCase:  testCase,
				Passed:    false,
				Error:     fmt.Sprintf("Failed to load policy: %v", err),
				Duration:  time.Since(startTime),
				Timestamp: time.Now(),
			})
			continue
		}

		// Evaluate policy
		actual, err := c.EvaluatePolicy(ctx, testCase.Input)
		if err != nil {
			results = append(results, TestResult{
				TestCase:  testCase,
				Passed:    false,
				Error:     fmt.Sprintf("Evaluation failed: %v", err),
				Duration:  time.Since(startTime),
				Timestamp: time.Now(),
			})
			continue
		}

		// Compare with expected
		passed := c.compareDecision(actual, &testCase.Expected)

		results = append(results, TestResult{
			TestCase:  testCase,
			Actual:    *actual,
			Passed:    passed,
			Duration:  time.Since(startTime),
			Timestamp: time.Now(),
		})
	}

	return results, nil
}

// compareDecision compares actual decision with expected
func (c *opaClient) compareDecision(actual *PolicyDecision, expected *PolicyDecision) bool {
	if actual.Allowed != expected.Allowed {
		return false
	}

	// TODO: Add more sophisticated comparison logic
	// - Compare reasons (with some tolerance for wording differences)
	// - Compare conditions
	// - Compare metadata

	return true
}

// GetPolicyMetrics returns current policy metrics
func (c *opaClient) GetPolicyMetrics(ctx context.Context) PolicyMetrics {
	return c.metrics.GetMetrics()
}

// Health checks OPA server health
func (c *opaClient) Health(ctx context.Context) error {
	url := fmt.Sprintf("%s/health", c.config.ServerURL)
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

// Helper functions
func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}

// Logger interface for policy logging
type Logger interface {
	Debug(msg string, fields map[string]interface{})
	Info(msg string, fields map[string]interface{})
	Warn(msg string, fields map[string]interface{})
	Error(msg string, fields map[string]interface{})
}
