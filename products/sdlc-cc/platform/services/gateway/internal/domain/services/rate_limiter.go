package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

// RateLimiterService provides distributed rate limiting and quota management
type RateLimiterService interface {
	// CheckRateLimit checks if request is allowed under rate limits
	CheckRateLimit(ctx context.Context, req *RateLimitRequest) (*RateLimitResult, error)

	// ConsumeQuota consumes quota for a tenant/user
	ConsumeQuota(ctx context.Context, req *QuotaRequest) (*QuotaResult, error)

	// GetRateLimitInfo returns current rate limit status
	GetRateLimitInfo(ctx context.Context, key string) (*RateLimitInfo, error)

	// GetQuotaInfo returns current quota status
	GetQuotaInfo(ctx context.Context, tenantID string) (*QuotaInfo, error)

	// BlockIP blocks an IP address
	BlockIP(ctx context.Context, ip string, duration time.Duration, reason string) error

	// IsIPBlocked checks if IP is blocked
	IsIPBlocked(ctx context.Context, ip string) (*BlockInfo, error)

	// UpdatePolicy updates rate limiting policy
	UpdatePolicy(ctx context.Context, policy *RateLimitPolicy) error

	// GetMetrics returns rate limiting metrics
	GetMetrics() *RateLimitMetrics
}

// RateLimitRequest represents a rate limit check request
type RateLimitRequest struct {
	Key       string            `json:"key"`        // Unique identifier (user ID, IP, API key, etc.)
	TenantID  string            `json:"tenant_id"`  // Tenant ID for multi-tenancy
	UserID    string            `json:"user_id"`    // User ID (optional)
	IPAddress string            `json:"ip_address"` // Client IP address
	Endpoint  string            `json:"endpoint"`   // API endpoint
	Method    string            `json:"method"`     // HTTP method
	Headers   map[string]string `json:"headers"`    // Request headers
	Timestamp time.Time         `json:"timestamp"`  // Request timestamp
	Weight    int               `json:"weight"`     // Request weight (default: 1)
	Burst     bool              `json:"burst"`      // Is this a burst request?
}

// RateLimitResult represents the result of a rate limit check
type RateLimitResult struct {
	Allowed       bool             `json:"allowed"`
	Limit         int              `json:"limit"`
	Remaining     int              `json:"remaining"`
	ResetTime     time.Time        `json:"reset_time"`
	RetryAfter    time.Duration    `json:"retry_after"`
	PolicyApplied *RateLimitPolicy `json:"policy_applied"`
	Metrics       *RequestMetrics  `json:"metrics"`
}

// QuotaRequest represents a quota consumption request
type QuotaRequest struct {
	TenantID     string            `json:"tenant_id"`
	UserID       string            `json:"user_id"`
	ResourceType string            `json:"resource_type"`
	Amount       int64             `json:"amount"`
	Metadata     map[string]string `json:"metadata"`
	Timestamp    time.Time         `json:"timestamp"`
}

// QuotaResult represents the result of quota consumption
type QuotaResult struct {
	Success       bool      `json:"success"`
	Consumed      int64     `json:"consumed"`
	Remaining     int64     `json:"remaining"`
	Limit         int64     `json:"limit"`
	ResetTime     time.Time `json:"reset_time"`
	ExceededLimit bool      `json:"exceeded_limit"`
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

// RateLimitInfo provides current rate limit status
type RateLimitInfo struct {
	Key         string                 `json:"key"`
	Limits      map[string]LimitStatus `json:"limits"`
	Usage       map[string]UsageStatus `json:"usage"`
	Policies    []string               `json:"policies"`
	Blocked     bool                   `json:"blocked"`
	BlockInfo   *BlockInfo             `json:"block_info,omitempty"`
	LastUpdated time.Time              `json:"last_updated"`
}

// LimitStatus shows status of a specific limit
type LimitStatus struct {
	Type           string        `json:"type"`
	Window         time.Duration `json:"window"`
	Limit          int64         `json:"limit"`
	Used           int64         `json:"used"`
	Remaining      int64         `json:"remaining"`
	ResetTime      time.Time     `json:"reset_time"`
	BurstUsed      int64         `json:"burst_used"`
	BurstRemaining int64         `json:"burst_remaining"`
}

// UsageStatus tracks usage over time
type UsageStatus struct {
	CurrentWindow  UsageWindow `json:"current_window"`
	PreviousWindow UsageWindow `json:"previous_window"`
	Today          UsageWindow `json:"today"`
	ThisMonth      UsageWindow `json:"this_month"`
}

// UsageWindow tracks usage in a time window
type UsageWindow struct {
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	Count     int64     `json:"count"`
	Amount    int64     `json:"amount"`
}

// QuotaInfo provides current quota status
type QuotaInfo struct {
	TenantID    string                 `json:"tenant_id"`
	Quotas      map[string]QuotaStatus `json:"quotas"`
	Usage       map[string]UsageStatus `json:"usage"`
	LastUpdated time.Time              `json:"last_updated"`
}

// QuotaStatus shows status of a specific quota
type QuotaStatus struct {
	ResourceType string        `json:"resource_type"`
	Limit        int64         `json:"limit"`
	Used         int64         `json:"used"`
	Remaining    int64         `json:"remaining"`
	ResetTime    time.Time     `json:"reset_time"`
	Period       time.Duration `json:"period"`
}

// BlockInfo contains IP blocking information
type BlockInfo struct {
	IPAddress      string    `json:"ip_address"`
	BlockedAt      time.Time `json:"blocked_at"`
	ExpiresAt      time.Time `json:"expires_at"`
	Reason         string    `json:"reason"`
	BlockType      string    `json:"block_type"` // manual, automatic, abuse_detection
	Severity       string    `json:"severity"`   // low, medium, high, critical
	RequestCount   int64     `json:"request_count"`
	ViolationCount int64     `json:"violation_count"`
}

// RequestMetrics tracks request metrics
type RequestMetrics struct {
	RequestID       string        `json:"request_id"`
	ProcessingTime  time.Duration `json:"processing_time"`
	PolicyMatchTime time.Duration `json:"policy_match_time"`
	StorageTime     time.Duration `json:"storage_time"`
	CacheHit        bool          `json:"cache_hit"`
	TracesEnabled   bool          `json:"traces_enabled"`
}

// RateLimitMetrics tracks rate limiting performance
type RateLimitMetrics struct {
	TotalRequests       int64         `json:"total_requests"`
	AllowedRequests     int64         `json:"allowed_requests"`
	BlockedRequests     int64         `json:"blocked_requests"`
	QueuedRequests      int64         `json:"queued_requests"`
	AverageLatency      time.Duration `json:"average_latency"`
	P95Latency          time.Duration `json:"p95_latency"`
	P99Latency          time.Duration `json:"p99_latency"`
	CacheHitRate        float64       `json:"cache_hit_rate"`
	AbuseDetectionCount int64         `json:"abuse_detection_count"`
	IPBlockCount        int64         `json:"ip_block_count"`
	LastUpdated         time.Time     `json:"last_updated"`
}

// RateLimiter implements RateLimiterService using Cloudflare KV
type RateLimiter struct {
	config        *config.Config
	kvStore       KVStore
	cache         RateLimitCache
	policyManager PolicyManager
	metrics       MetricsCollector
	abuseDetector AbuseDetector
	ipBlocker     IPBlocker
	logger        *logrus.Logger
	mutex         sync.RWMutex
}

// KVStore interface for distributed key-value storage
type KVStore interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
	BulkGet(ctx context.Context, keys []string) (map[string][]byte, error)
	BulkSet(ctx context.Context, items map[string][]byte, ttl time.Duration) error
	Increment(ctx context.Context, key string, delta int64, ttl time.Duration) (int64, error)
	GetRange(ctx context.Context, prefix string) (map[string][]byte, error)
}

// RateLimitCache interface for local caching
type RateLimitCache interface {
	Get(key string) (*RateLimitInfo, bool)
	Set(key string, info *RateLimitInfo, ttl time.Duration)
	Delete(key string)
	Clear()
	Stats() CacheStats
}

// CacheStats provides cache statistics
type CacheStats struct {
	Hits        int64   `json:"hits"`
	Misses      int64   `json:"misses"`
	HitRate     float64 `json:"hit_rate"`
	TotalKeys   int64   `json:"total_keys"`
	MemoryUsage int64   `json:"memory_usage"`
}

// PolicyManager interface for managing rate limit policies
type PolicyManager interface {
	GetMatchingPolicies(req *RateLimitRequest) ([]*RateLimitPolicy, error)
	GetPolicy(id string) (*RateLimitPolicy, error)
	UpdatePolicy(policy *RateLimitPolicy) error
	DeletePolicy(id string) error
	ListPolicies() ([]*RateLimitPolicy, error)
}

// AbuseDetector interface for detecting abuse patterns
type AbuseDetector interface {
	AnalyzeRequest(ctx context.Context, req *RateLimitRequest) (*AbuseAnalysis, error)
	UpdatePattern(ctx context.Context, pattern *AbusePattern) error
	GetSuspiciousIPs(ctx context.Context, threshold float64) ([]string, error)
}

// AbuseAnalysis represents abuse detection results
type AbuseAnalysis struct {
	Score           float64         `json:"score"`
	RiskLevel       string          `json:"risk_level"`
	ThreatTypes     []string        `json:"threat_types"`
	Patterns        []*AbusePattern `json:"patterns"`
	Recommendations []string        `json:"recommendations"`
	BlockSuggested  bool            `json:"block_suggested"`
	BlockDuration   time.Duration   `json:"block_duration"`
	Confidence      float64         `json:"confidence"`
}

// AbusePattern represents a detected abuse pattern
type AbusePattern struct {
	ID        string            `json:"id"`
	Type      string            `json:"type"`      // ddos, brute_force, abuse, etc.
	Pattern   string            `json:"pattern"`   // Regex or rule pattern
	Threshold float64           `json:"threshold"` // Detection threshold
	Weight    float64           `json:"weight"`    // Pattern weight
	Window    time.Duration     `json:"window"`    // Detection window
	Metadata  map[string]string `json:"metadata"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// IPBlocker interface for IP blocking
type IPBlocker interface {
	BlockIP(ctx context.Context, ip string, duration time.Duration, reason string, blockType string) error
	UnblockIP(ctx context.Context, ip string) error
	IsBlocked(ctx context.Context, ip string) (*BlockInfo, error)
	GetBlockedIPs(ctx context.Context) ([]*BlockInfo, error)
}

// MetricsCollector interface for collecting metrics
type MetricsCollector interface {
	RecordRequest(req *RateLimitRequest, result *RateLimitResult)
	RecordQuotaConsumption(req *QuotaRequest, result *QuotaResult)
	RecordPolicyMatch(policyID string, matchTime time.Duration)
	RecordAbuseDetection(analysis *AbuseAnalysis)
	RecordIPBlock(blockInfo *BlockInfo)
	GetMetrics() *RateLimitMetrics
}

// NewRateLimiter creates a new rate limiter instance
func NewRateLimiter(
	cfg *config.Config,
	kvStore KVStore,
	cache RateLimitCache,
	policyManager PolicyManager,
	metrics MetricsCollector,
	abuseDetector AbuseDetector,
	ipBlocker IPBlocker,
	logger *logrus.Logger,
) *RateLimiter {
	return &RateLimiter{
		config:        cfg,
		kvStore:       kvStore,
		cache:         cache,
		policyManager: policyManager,
		metrics:       metrics,
		abuseDetector: abuseDetector,
		ipBlocker:     ipBlocker,
		logger:        logger,
	}
}

// CheckRateLimit implements RateLimiterService
func (r *RateLimiter) CheckRateLimit(ctx context.Context, req *RateLimitRequest) (*RateLimitResult, error) {
	startTime := time.Now()
	span := trace.SpanFromContext(ctx)

	r.logger.WithFields(logrus.Fields{
		"key":       req.Key,
		"tenant_id": req.TenantID,
		"endpoint":  req.Endpoint,
	}).Debug("Checking rate limit")

	// Check if IP is blocked first
	if req.IPAddress != "" {
		if blockInfo, err := r.ipBlocker.IsBlocked(ctx, req.IPAddress); err == nil && blockInfo != nil {
			r.logger.WithFields(logrus.Fields{
				"ip":     req.IPAddress,
				"reason": blockInfo.Reason,
			}).Warn("Request from blocked IP rejected")

			return &RateLimitResult{
				Allowed:    false,
				RetryAfter: blockInfo.ExpiresAt.Sub(time.Now()),
				Metrics: &RequestMetrics{
					RequestID:      span.SpanContext().TraceID().String(),
					ProcessingTime: time.Since(startTime),
					CacheHit:       false,
					TracesEnabled:  span.IsRecording(),
				},
			}, nil
		}
	}

	// Get matching policies
	policies, err := r.policyManager.GetMatchingPolicies(req)
	if err != nil {
		r.logger.WithError(err).Error("Failed to get matching policies")
		return nil, fmt.Errorf("failed to get matching policies: %w", err)
	}

	if len(policies) == 0 {
		// No policies match, allow by default
		r.logger.Debug("No policies matched, allowing request")
		return &RateLimitResult{
			Allowed: true,
			Limit:   0,
			Metrics: &RequestMetrics{
				RequestID:      span.SpanContext().TraceID().String(),
				ProcessingTime: time.Since(startTime),
				CacheHit:       false,
				TracesEnabled:  span.IsRecording(),
			},
		}, nil
	}

	// Check cache first
	cacheKey := r.buildCacheKey(req)
	if cachedInfo, found := r.cache.Get(cacheKey); found {
		r.logger.Debug("Rate limit info found in cache")
		result := r.evaluateAgainstCachedInfo(req, cachedInfo, policies[0])
		result.Metrics.CacheHit = true
		result.Metrics.ProcessingTime = time.Since(startTime)
		r.metrics.RecordRequest(req, result)
		return result, nil
	}

	// Get current usage from KV store
	usageInfo, err := r.getCurrentUsage(ctx, req, policies)
	if err != nil {
		r.logger.WithError(err).Error("Failed to get current usage")
		return nil, fmt.Errorf("failed to get current usage: %w", err)
	}

	// Evaluate against highest priority policy
	result := r.evaluateRequest(ctx, req, usageInfo, policies[0])
	result.Metrics = &RequestMetrics{
		RequestID:      span.SpanContext().TraceID().String(),
		ProcessingTime: time.Since(startTime),
		CacheHit:       false,
		TracesEnabled:  span.IsRecording(),
	}

	// Update usage in KV store if allowed
	if result.Allowed {
		if err := r.updateUsage(ctx, req, usageInfo, policies[0]); err != nil {
			r.logger.WithError(err).Error("Failed to update usage")
			// Don't fail the request, just log the error
		}

		// Cache the result
		r.cache.Set(cacheKey, usageInfo, time.Minute)
	}

	// Run abuse detection asynchronously — the IP block must persist beyond
	// the current request's lifetime, so Background is intentional.
	go func() { // #nosec G118 -- abuse-detection writer outlives request
		if analysis, err := r.abuseDetector.AnalyzeRequest(ctx, req); err == nil {
			if analysis.BlockSuggested && analysis.Score > 0.8 {
				if blockErr := r.ipBlocker.BlockIP(context.Background(), req.IPAddress, analysis.BlockDuration, analysis.Recommendations[0], "automatic"); blockErr != nil {
					r.logger.WithError(blockErr).WithField("ip", req.IPAddress).Warn("Failed to block IP from abuse detector")
				}
			}
			r.metrics.RecordAbuseDetection(analysis)
		}
	}()

	// Record metrics
	r.metrics.RecordRequest(req, result)

	return result, nil
}

// ConsumeQuota implements RateLimiterService
func (r *RateLimiter) ConsumeQuota(ctx context.Context, req *QuotaRequest) (*QuotaResult, error) {
	r.logger.WithFields(logrus.Fields{
		"tenant_id":     req.TenantID,
		"user_id":       req.UserID,
		"resource_type": req.ResourceType,
		"amount":        req.Amount,
	}).Debug("Consuming quota")

	// Get current quota status
	quotaKey := fmt.Sprintf("quota:%s:%s", req.TenantID, req.ResourceType)

	currentData, err := r.kvStore.Get(ctx, quotaKey)
	if err != nil {
		r.logger.WithError(err).Error("Failed to get current quota")
		return nil, fmt.Errorf("failed to get current quota: %w", err)
	}

	var quotaStatus QuotaStatus
	if len(currentData) > 0 {
		if err := json.Unmarshal(currentData, &quotaStatus); err != nil {
			r.logger.WithError(err).Error("Failed to unmarshal quota status")
			return nil, fmt.Errorf("failed to unmarshal quota status: %w", err)
		}
	} else {
		// Initialize with default quota
		quotaStatus = QuotaStatus{
			ResourceType: req.ResourceType,
			Limit:        1000000, // Default limit
			Used:         0,
			Remaining:    1000000,
			ResetTime:    time.Now().AddDate(0, 1, 0), // Monthly reset
			Period:       30 * 24 * time.Hour,
		}
	}

	// Check if quota is expired
	if time.Now().After(quotaStatus.ResetTime) {
		quotaStatus.Used = 0
		quotaStatus.Remaining = quotaStatus.Limit
		quotaStatus.ResetTime = time.Now().Add(quotaStatus.Period)
	}

	// Check if quota consumption is allowed
	exceededLimit := false
	if quotaStatus.Used+req.Amount > quotaStatus.Limit {
		exceededLimit = true
		r.logger.WithFields(logrus.Fields{
			"current_usage": quotaStatus.Used,
			"requested":     req.Amount,
			"limit":         quotaStatus.Limit,
		}).Warn("Quota limit exceeded")
	}

	// Update quota if allowed
	if !exceededLimit {
		quotaStatus.Used += req.Amount
		quotaStatus.Remaining = quotaStatus.Limit - quotaStatus.Used

		// Save updated quota status
		quotaData, err := json.Marshal(quotaStatus)
		if err != nil {
			r.logger.WithError(err).Error("Failed to marshal quota status")
			return nil, fmt.Errorf("failed to marshal quota status: %w", err)
		}

		if err := r.kvStore.Set(ctx, quotaKey, quotaData, 24*time.Hour); err != nil {
			r.logger.WithError(err).Error("Failed to save quota status")
			return nil, fmt.Errorf("failed to save quota status: %w", err)
		}
	}

	result := &QuotaResult{
		Success:       !exceededLimit,
		Consumed:      req.Amount,
		Remaining:     quotaStatus.Remaining,
		Limit:         quotaStatus.Limit,
		ResetTime:     quotaStatus.ResetTime,
		ExceededLimit: exceededLimit,
	}

	r.metrics.RecordQuotaConsumption(req, result)

	return result, nil
}

// GetRateLimitInfo implements RateLimiterService
func (r *RateLimiter) GetRateLimitInfo(ctx context.Context, key string) (*RateLimitInfo, error) {
	cacheKey := fmt.Sprintf("rate_limit_info:%s", key)

	// Try cache first
	if cachedInfo, found := r.cache.Get(cacheKey); found {
		return cachedInfo, nil
	}

	// Get from KV store
	data, err := r.kvStore.Get(ctx, cacheKey)
	if err != nil {
		return nil, fmt.Errorf("failed to get rate limit info: %w", err)
	}

	var info RateLimitInfo
	if len(data) > 0 {
		if err := json.Unmarshal(data, &info); err != nil {
			return nil, fmt.Errorf("failed to unmarshal rate limit info: %w", err)
		}
	} else {
		info = RateLimitInfo{
			Key:         key,
			Limits:      make(map[string]LimitStatus),
			Usage:       make(map[string]UsageStatus),
			Policies:    []string{},
			Blocked:     false,
			LastUpdated: time.Now(),
		}
	}

	// Cache the info
	r.cache.Set(cacheKey, &info, time.Minute)

	return &info, nil
}

// GetQuotaInfo implements RateLimiterService
func (r *RateLimiter) GetQuotaInfo(ctx context.Context, tenantID string) (*QuotaInfo, error) {
	// Get all quota keys for tenant
	prefix := fmt.Sprintf("quota:%s:", tenantID)
	quotaData, err := r.kvStore.GetRange(ctx, prefix)
	if err != nil {
		return nil, fmt.Errorf("failed to get quota data: %w", err)
	}

	quotas := make(map[string]QuotaStatus)
	usage := make(map[string]UsageStatus)

	for key, data := range quotaData {
		var quotaStatus QuotaStatus
		if err := json.Unmarshal(data, &quotaStatus); err != nil {
			r.logger.WithError(err).WithField("key", key).Error("Failed to unmarshal quota status")
			continue
		}

		resourceType := strings.TrimPrefix(key, prefix)
		quotas[resourceType] = quotaStatus

		// Create usage status
		usage[resourceType] = UsageStatus{
			CurrentWindow: UsageWindow{
				StartTime: quotaStatus.ResetTime.Add(-quotaStatus.Period),
				EndTime:   quotaStatus.ResetTime,
				Count:     quotaStatus.Used,
				Amount:    quotaStatus.Used,
			},
		}
	}

	return &QuotaInfo{
		TenantID:    tenantID,
		Quotas:      quotas,
		Usage:       usage,
		LastUpdated: time.Now(),
	}, nil
}

// BlockIP implements RateLimiterService
func (r *RateLimiter) BlockIP(ctx context.Context, ip string, duration time.Duration, reason string) error {
	return r.ipBlocker.BlockIP(ctx, ip, duration, reason, "manual")
}

// IsIPBlocked implements RateLimiterService
func (r *RateLimiter) IsIPBlocked(ctx context.Context, ip string) (*BlockInfo, error) {
	return r.ipBlocker.IsBlocked(ctx, ip)
}

// UpdatePolicy implements RateLimiterService
func (r *RateLimiter) UpdatePolicy(ctx context.Context, policy *RateLimitPolicy) error {
	return r.policyManager.UpdatePolicy(policy)
}

// GetMetrics implements RateLimiterService
func (r *RateLimiter) GetMetrics() *RateLimitMetrics {
	return r.metrics.GetMetrics()
}

// Helper methods

func (r *RateLimiter) buildCacheKey(req *RateLimitRequest) string {
	return fmt.Sprintf("rate_limit:%s:%s:%s:%s",
		req.TenantID, req.UserID, req.IPAddress, req.Endpoint)
}

func (r *RateLimiter) getCurrentUsage(ctx context.Context, req *RateLimitRequest, policies []*RateLimitPolicy) (*RateLimitInfo, error) {
	info := &RateLimitInfo{
		Key:         req.Key,
		Limits:      make(map[string]LimitStatus),
		Usage:       make(map[string]UsageStatus),
		Policies:    make([]string, len(policies)),
		Blocked:     false,
		LastUpdated: time.Now(),
	}

	for i, policy := range policies {
		info.Policies[i] = policy.ID

		for _, limit := range policy.Limits {
			limitKey := fmt.Sprintf("%s:%s:%s:%s",
				req.Key, policy.ID, limit.Type, limit.Window.String())

			data, err := r.kvStore.Get(ctx, limitKey)
			if err != nil {
				r.logger.WithError(err).Warn("Failed to get limit data")
				continue
			}

			var count int64
			if len(data) > 0 {
				count, err = r.kvStore.Increment(ctx, limitKey, 0, limit.Window)
				if err != nil {
					r.logger.WithError(err).Warn("Failed to parse count")
					count = 0
				}
			}

			info.Limits[limitTypeKey(limit.Type, limit.Window)] = LimitStatus{
				Type:           limit.Type,
				Window:         limit.Window,
				Limit:          limit.Value,
				Used:           count,
				Remaining:      max(0, limit.Value-count),
				ResetTime:      time.Now().Add(limit.Window),
				BurstUsed:      0,
				BurstRemaining: limit.Burst,
			}
		}
	}

	return info, nil
}

func (r *RateLimiter) evaluateAgainstCachedInfo(req *RateLimitRequest, info *RateLimitInfo, policy *RateLimitPolicy) *RateLimitResult {
	result := &RateLimitResult{
		Allowed:       true,
		PolicyApplied: policy,
	}

	for _, limit := range policy.Limits {
		limitKey := limitTypeKey(limit.Type, limit.Window)
		limitStatus, exists := info.Limits[limitKey]
		if !exists {
			continue
		}

		// Check if limit exceeded
		if limitStatus.Used >= limit.Value {
			result.Allowed = false
			result.Limit = int(limit.Value)
			result.Remaining = max(0, int(limit.Value-limitStatus.Used))
			result.ResetTime = limitStatus.ResetTime
			result.RetryAfter = limitStatus.ResetTime.Sub(time.Now())
			break
		}

		// Update result with most restrictive limit
		if result.Limit == 0 || int(limit.Value) < result.Limit {
			result.Limit = int(limit.Value)
			result.Remaining = int(limitStatus.Remaining)
		}
	}

	return result
}

func (r *RateLimiter) evaluateRequest(ctx context.Context, req *RateLimitRequest, info *RateLimitInfo, policy *RateLimitPolicy) *RateLimitResult {
	result := &RateLimitResult{
		Allowed:       true,
		PolicyApplied: policy,
	}

	for _, limit := range policy.Limits {
		limitKey := limitTypeKey(limit.Type, limit.Window)
		limitStatus, exists := info.Limits[limitKey]
		if !exists {
			continue
		}

		// Check if limit exceeded
		if limitStatus.Used >= limit.Value {
			result.Allowed = false
			result.Limit = int(limit.Value)
			result.Remaining = max(0, int(limit.Value-limitStatus.Used))
			result.ResetTime = limitStatus.ResetTime
			result.RetryAfter = limitStatus.ResetTime.Sub(time.Now())

			// Apply penalty if configured
			if policy.PenaltyEnabled {
				result.RetryAfter = time.Duration(float64(result.RetryAfter) * (1 + limit.Penalty))
			}
			break
		}

		// Update result with most restrictive limit
		if result.Limit == 0 || int(limit.Value) < result.Limit {
			result.Limit = int(limit.Value)
			result.Remaining = int(limitStatus.Remaining)
		}
	}

	return result
}

func (r *RateLimiter) updateUsage(ctx context.Context, req *RateLimitRequest, info *RateLimitInfo, policy *RateLimitPolicy) error {
	for _, limit := range policy.Limits {
		limitKey := fmt.Sprintf("%s:%s:%s:%s",
			req.Key, policy.ID, limit.Type, limit.Window.String())

		// Increment counter
		_, err := r.kvStore.Increment(ctx, limitKey, 1, limit.Window)
		if err != nil {
			return fmt.Errorf("failed to increment usage counter: %w", err)
		}

		// Update cached info
		limitStatusKey := limitTypeKey(limit.Type, limit.Window)
		if limitStatus, exists := info.Limits[limitStatusKey]; exists {
			limitStatus.Used++
			limitStatus.Remaining = max(0, limitStatus.Limit-limitStatus.Used)
			info.Limits[limitStatusKey] = limitStatus
		}
	}

	return nil
}

func limitTypeKey(limitType string, window time.Duration) string {
	return fmt.Sprintf("%s:%s", limitType, window.String())
}

// Allower is the minimal per-request rate-limit contract used by the
// Redis sliding-window implementation. The weight parameter is the cost
// of the request (typically 1). retryAfter is only meaningful when
// allowed is false.
type Allower interface {
	Allow(ctx context.Context, tenantID, route string, weight int) (allowed bool, retryAfter time.Duration, err error)
}
