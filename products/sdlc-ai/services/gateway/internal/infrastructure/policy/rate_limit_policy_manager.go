package policy

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// RateLimitPolicyManager implements PolicyManager for rate limiting policies
type RateLimitPolicyManager struct {
	policies map[string]*RateLimitPolicy
	mutex    sync.RWMutex
	logger   *logrus.Logger
	storage  PolicyStorage
}

// RateLimitPolicy defines rate limiting rules
type RateLimitPolicy struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	Priority       int           `json:"priority"`
	Conditions     []Condition   `json:"conditions"`
	Limits         []Limit       `json:"limits"`
	BurstCapacity  int           `json:"burst_capacity"`
	QueueEnabled   bool          `json:"queue_enabled"`
	QueueSize      int           `json:"queue_size"`
	QueueTimeout   time.Duration `json:"queue_timeout"`
	PenaltyEnabled bool          `json:"penalty_enabled"`
	PenaltyDelay   time.Duration `json:"penalty_delay"`
	Enabled        bool          `json:"enabled"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

// Condition defines when a policy applies
type Condition struct {
	Field    string      `json:"field"`    // Field to check (tenant_id, user_id, ip, endpoint, etc.)
	Operator string      `json:"operator"` // Operator (eq, ne, in, not_in, regex, etc.)
	Value    interface{} `json:"value"`    // Value to compare against
}

// Limit defines rate limits
type Limit struct {
	Type        string        `json:"type"`         // requests, bandwidth, tokens, etc.
	Window      time.Duration `json:"window"`       // Time window
	Value       int64         `json:"value"`        // Maximum allowed value
	Burst       int64         `json:"burst"`        // Burst capacity
	Penalty     float64       `json:"penalty"`      // Penalty factor for violations
	GracePeriod time.Duration `json:"grace_period"` // Grace period before enforcement
}

// RateLimitRequest represents a rate limit check request
type RateLimitRequest struct {
	Key       string            `json:"key"`
	TenantID  string            `json:"tenant_id"`
	UserID    string            `json:"user_id"`
	IPAddress string            `json:"ip_address"`
	Endpoint  string            `json:"endpoint"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	Timestamp time.Time         `json:"timestamp"`
	Weight    int               `json:"weight"`
	Burst     bool              `json:"burst"`
}

// PolicyStorage interface for persisting policies
type PolicyStorage interface {
	Load(ctx context.Context) (map[string]*RateLimitPolicy, error)
	Save(ctx context.Context, policies map[string]*RateLimitPolicy) error
	Watch(ctx context.Context) (<-chan PolicyEvent, error)
}

// PolicyEvent represents a policy change event
type PolicyEvent struct {
	Type   string           `json:"type"` // created, updated, deleted
	Policy *RateLimitPolicy `json:"policy"`
	Time   time.Time        `json:"time"`
}

// NewRateLimitPolicyManager creates a new policy manager
func NewRateLimitPolicyManager(storage PolicyStorage, logger *logrus.Logger) (*RateLimitPolicyManager, error) {
	manager := &RateLimitPolicyManager{
		policies: make(map[string]*RateLimitPolicy),
		logger:   logger,
		storage:  storage,
	}

	// Load existing policies
	if err := manager.loadPolicies(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to load policies: %w", err)
	}

	// Start watching for policy changes
	go manager.watchForChanges()

	return manager, nil
}

// GetMatchingPolicies returns all policies that match the request
func (pm *RateLimitPolicyManager) GetMatchingPolicies(req *RateLimitRequest) ([]*RateLimitPolicy, error) {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	var matchingPolicies []*RateLimitPolicy

	for _, policy := range pm.policies {
		if !policy.Enabled {
			continue
		}

		if pm.matchesConditions(policy.Conditions, req) {
			matchingPolicies = append(matchingPolicies, policy)
		}
	}

	// Sort by priority (higher priority first)
	sort.Slice(matchingPolicies, func(i, j int) bool {
		return matchingPolicies[i].Priority > matchingPolicies[j].Priority
	})

	return matchingPolicies, nil
}

// GetPolicy retrieves a policy by ID
func (pm *RateLimitPolicyManager) GetPolicy(id string) (*RateLimitPolicy, error) {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	policy, exists := pm.policies[id]
	if !exists {
		return nil, fmt.Errorf("policy not found: %s", id)
	}

	// Return a copy to prevent modification
	policyCopy := *policy
	return &policyCopy, nil
}

// UpdatePolicy creates or updates a policy
func (pm *RateLimitPolicyManager) UpdatePolicy(policy *RateLimitPolicy) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	// Validate policy
	if err := pm.validatePolicy(policy); err != nil {
		return fmt.Errorf("policy validation failed: %w", err)
	}

	// Set timestamps
	now := time.Now()
	if existingPolicy, exists := pm.policies[policy.ID]; exists {
		policy.CreatedAt = existingPolicy.CreatedAt
		policy.UpdatedAt = now
	} else {
		policy.CreatedAt = now
		policy.UpdatedAt = now
	}

	// Store policy
	pm.policies[policy.ID] = policy

	// Persist to storage
	if err := pm.storage.Save(context.Background(), pm.policies); err != nil {
		pm.logger.WithError(err).Error("Failed to persist policy update")
		return fmt.Errorf("failed to persist policy: %w", err)
	}

	pm.logger.WithFields(logrus.Fields{
		"policy_id":   policy.ID,
		"policy_name": policy.Name,
		"enabled":     policy.Enabled,
	}).Info("Policy updated")

	return nil
}

// DeletePolicy removes a policy
func (pm *RateLimitPolicyManager) DeletePolicy(id string) error {
	pm.mutex.Lock()
	defer pm.mutex.Unlock()

	if _, exists := pm.policies[id]; !exists {
		return fmt.Errorf("policy not found: %s", id)
	}

	delete(pm.policies, id)

	// Persist changes
	if err := pm.storage.Save(context.Background(), pm.policies); err != nil {
		pm.logger.WithError(err).Error("Failed to persist policy deletion")
		return fmt.Errorf("failed to persist policy deletion: %w", err)
	}

	pm.logger.WithField("policy_id", id).Info("Policy deleted")

	return nil
}

// ListPolicies returns all policies
func (pm *RateLimitPolicyManager) ListPolicies() ([]*RateLimitPolicy, error) {
	pm.mutex.RLock()
	defer pm.mutex.RUnlock()

	policies := make([]*RateLimitPolicy, 0, len(pm.policies))
	for _, policy := range pm.policies {
		policyCopy := *policy
		policies = append(policies, &policyCopy)
	}

	return policies, nil
}

// LoadDefaultPolicies loads default rate limiting policies
func (pm *RateLimitPolicyManager) LoadDefaultPolicies() error {
	defaultPolicies := []*RateLimitPolicy{
		{
			ID:       "global-default",
			Name:     "Global Default Rate Limit",
			Priority: 1,
			Conditions: []Condition{
				{Field: "*", Operator: "eq", Value: true},
			},
			Limits: []Limit{
				{
					Type:    "requests",
					Window:  time.Hour,
					Value:   1000,
					Burst:   100,
					Penalty: 1.0,
				},
			},
			BurstCapacity:  100,
			QueueEnabled:   true,
			QueueSize:      1000,
			QueueTimeout:   time.Minute * 5,
			PenaltyEnabled: true,
			PenaltyDelay:   time.Second * 30,
			Enabled:        true,
		},
		{
			ID:       "tenant-premium",
			Name:     "Premium Tenant Rate Limit",
			Priority: 10,
			Conditions: []Condition{
				{Field: "tenant_id", Operator: "in", Value: []string{"premium", "enterprise"}},
			},
			Limits: []Limit{
				{
					Type:    "requests",
					Window:  time.Hour,
					Value:   10000,
					Burst:   1000,
					Penalty: 0.5,
				},
				{
					Type:    "bandwidth",
					Window:  time.Hour,
					Value:   1024 * 1024 * 1024, // 1GB
					Burst:   100 * 1024 * 1024,  // 100MB
					Penalty: 0.5,
				},
			},
			BurstCapacity:  1000,
			QueueEnabled:   true,
			QueueSize:      5000,
			QueueTimeout:   time.Minute * 2,
			PenaltyEnabled: false,
			Enabled:        true,
		},
		{
			ID:       "endpoint-sensitive",
			Name:     "Sensitive Endpoint Protection",
			Priority: 20,
			Conditions: []Condition{
				{Field: "endpoint", Operator: "regex", Value: "^/api/v1/(auth|admin|billing)"},
			},
			Limits: []Limit{
				{
					Type:        "requests",
					Window:      time.Minute * 5,
					Value:       100,
					Burst:       20,
					Penalty:     2.0,
					GracePeriod: time.Minute,
				},
			},
			BurstCapacity:  20,
			QueueEnabled:   false,
			QueueSize:      0,
			QueueTimeout:   0,
			PenaltyEnabled: true,
			PenaltyDelay:   time.Minute * 2,
			Enabled:        true,
		},
		{
			ID:       "ip-protection",
			Name:     "IP-based Abuse Protection",
			Priority: 5,
			Conditions: []Condition{
				{Field: "ip_address", Operator: "ne", Value: ""},
			},
			Limits: []Limit{
				{
					Type:    "requests",
					Window:  time.Minute,
					Value:   60,
					Burst:   10,
					Penalty: 3.0,
				},
			},
			BurstCapacity:  10,
			QueueEnabled:   true,
			QueueSize:      100,
			QueueTimeout:   time.Minute,
			PenaltyEnabled: true,
			PenaltyDelay:   time.Minute * 5,
			Enabled:        true,
		},
	}

	for _, policy := range defaultPolicies {
		if err := pm.UpdatePolicy(policy); err != nil {
			return fmt.Errorf("failed to load default policy %s: %w", policy.ID, err)
		}
	}

	pm.logger.Info("Default rate limiting policies loaded")
	return nil
}

// Helper methods

func (pm *RateLimitPolicyManager) loadPolicies(ctx context.Context) error {
	policies, err := pm.storage.Load(ctx)
	if err != nil {
		return fmt.Errorf("failed to load policies from storage: %w", err)
	}

	pm.policies = policies
	pm.logger.WithField("policy_count", len(policies)).Info("Policies loaded from storage")

	return nil
}

func (pm *RateLimitPolicyManager) watchForChanges() {
	eventChan, err := pm.storage.Watch(context.Background())
	if err != nil {
		pm.logger.WithError(err).Error("Failed to start watching for policy changes")
		return
	}

	for event := range eventChan {
		pm.mutex.Lock()
		switch event.Type {
		case "created", "updated":
			pm.policies[event.Policy.ID] = event.Policy
			pm.logger.WithFields(logrus.Fields{
				"policy_id":   event.Policy.ID,
				"policy_name": event.Policy.Name,
				"event_type":  event.Type,
			}).Info("Policy updated from storage")
		case "deleted":
			delete(pm.policies, event.Policy.ID)
			pm.logger.WithField("policy_id", event.Policy.ID).Info("Policy deleted from storage")
		}
		pm.mutex.Unlock()
	}
}

func (pm *RateLimitPolicyManager) matchesConditions(conditions []Condition, req *RateLimitRequest) bool {
	if len(conditions) == 0 {
		return true
	}

	for _, condition := range conditions {
		if !pm.matchesCondition(condition, req) {
			return false
		}
	}

	return true
}

func (pm *RateLimitPolicyManager) matchesCondition(condition Condition, req *RateLimitRequest) bool {
	var fieldValue interface{}

	switch condition.Field {
	case "tenant_id":
		fieldValue = req.TenantID
	case "user_id":
		fieldValue = req.UserID
	case "ip_address":
		fieldValue = req.IPAddress
	case "endpoint":
		fieldValue = req.Endpoint
	case "method":
		fieldValue = req.Method
	case "key":
		fieldValue = req.Key
	case "weight":
		fieldValue = req.Weight
	case "burst":
		fieldValue = req.Burst
	case "headers":
		fieldValue = req.Headers
	case "*":
		return true // Wildcard condition always matches
	default:
		// Check if it's a header field
		if strings.HasPrefix(condition.Field, "header.") {
			headerName := strings.TrimPrefix(condition.Field, "header.")
			fieldValue = req.Headers[headerName]
		} else {
			return false // Unknown field
		}
	}

	return pm.evaluateOperator(fieldValue, condition.Operator, condition.Value)
}

func (pm *RateLimitPolicyManager) evaluateOperator(fieldValue interface{}, operator string, conditionValue interface{}) bool {
	switch operator {
	case "eq":
		return fieldValue == conditionValue
	case "ne":
		return fieldValue != conditionValue
	case "in":
		if values, ok := conditionValue.([]interface{}); ok {
			for _, v := range values {
				if fieldValue == v {
					return true
				}
			}
		}
		return false
	case "not_in":
		if values, ok := conditionValue.([]interface{}); ok {
			for _, v := range values {
				if fieldValue == v {
					return false
				}
			}
			return true
		}
		return false
	case "regex":
		if fieldStr, ok := fieldValue.(string); ok {
			if patternStr, ok := conditionValue.(string); ok {
				matched, err := regexp.MatchString(patternStr, fieldStr)
				if err != nil {
					pm.logger.WithError(err).Error("Invalid regex pattern")
					return false
				}
				return matched
			}
		}
		return false
	case "contains":
		if fieldStr, ok := fieldValue.(string); ok {
			if valueStr, ok := conditionValue.(string); ok {
				return strings.Contains(fieldStr, valueStr)
			}
		}
		return false
	case "starts_with":
		if fieldStr, ok := fieldValue.(string); ok {
			if valueStr, ok := conditionValue.(string); ok {
				return strings.HasPrefix(fieldStr, valueStr)
			}
		}
		return false
	case "ends_with":
		if fieldStr, ok := fieldValue.(string); ok {
			if valueStr, ok := conditionValue.(string); ok {
				return strings.HasSuffix(fieldStr, valueStr)
			}
		}
		return false
	case "gt":
		return pm.compareNumeric(fieldValue, conditionValue, func(a, b int64) bool { return a > b })
	case "gte":
		return pm.compareNumeric(fieldValue, conditionValue, func(a, b int64) bool { return a >= b })
	case "lt":
		return pm.compareNumeric(fieldValue, conditionValue, func(a, b int64) bool { return a < b })
	case "lte":
		return pm.compareNumeric(fieldValue, conditionValue, func(a, b int64) bool { return a <= b })
	default:
		pm.logger.WithField("operator", operator).Warn("Unknown operator")
		return false
	}
}

func (pm *RateLimitPolicyManager) compareNumeric(a, b interface{}, compare func(int64, int64) bool) bool {
	aNum, ok1 := pm.toInt64(a)
	bNum, ok2 := pm.toInt64(b)
	if !ok1 || !ok2 {
		return false
	}
	return compare(aNum, bNum)
}

func (pm *RateLimitPolicyManager) toInt64(value interface{}) (int64, bool) {
	switch v := value.(type) {
	case int:
		return int64(v), true
	case int64:
		return v, true
	case float64:
		return int64(v), true
	case string:
		if parsed, err := time.ParseDuration(v); err == nil {
			return int64(parsed), true
		}
		if parsed, err := strconv.ParseInt(v, 10, 64); err == nil {
			return parsed, true
		}
	}
	return 0, false
}

func (pm *RateLimitPolicyManager) validatePolicy(policy *RateLimitPolicy) error {
	if policy.ID == "" {
		return fmt.Errorf("policy ID is required")
	}
	if policy.Name == "" {
		return fmt.Errorf("policy name is required")
	}
	if len(policy.Limits) == 0 {
		return fmt.Errorf("policy must have at least one limit")
	}

	for i, limit := range policy.Limits {
		if limit.Type == "" {
			return fmt.Errorf("limit %d: type is required", i)
		}
		if limit.Window <= 0 {
			return fmt.Errorf("limit %d: window must be positive", i)
		}
		if limit.Value <= 0 {
			return fmt.Errorf("limit %d: value must be positive", i)
		}
		if limit.Burst < 0 {
			return fmt.Errorf("limit %d: burst cannot be negative", i)
		}
	}

	return nil
}
