package cache

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// DecisionCache provides caching for policy decisions
type DecisionCache struct {
	redis     *redis.Client
	logger    *logrus.Logger
	config    DecisionCacheConfig
	metrics   *CacheMetrics
	keyPrefix string
}

// DecisionCacheConfig holds configuration for the decision cache
type DecisionCacheConfig struct {
	KeyPrefix          string        `json:"key_prefix"`
	DefaultTTL         time.Duration `json:"default_ttl"`
	MaxCacheSize       int           `json:"max_cache_size"`
	CleanupInterval    time.Duration `json:"cleanup_interval"`
	EnableMetrics      bool          `json:"enable_metrics"`
	CompressionEnabled bool          `json:"compression_enabled"`
	SerializerType     string        `json:"serializer_type"`
}

// CacheMetrics tracks cache performance metrics
type CacheMetrics struct {
	Hits         int64         `json:"hits"`
	Misses       int64         `json:"misses"`
	Sets         int64         `json:"sets"`
	Deletes      int64         `json:"deletes"`
	Errors       int64         `json:"errors"`
	LastHit      time.Time     `json:"last_hit"`
	LastMiss     time.Time     `json:"last_miss"`
	TotalLatency time.Duration `json:"total_latency"`
	AvgLatency   time.Duration `json:"avg_latency"`
	MaxLatency   time.Duration `json:"max_latency"`
	MinLatency   time.Duration `json:"min_latency"`
	CacheSize    int64         `json:"cache_size"`
	MemoryUsage  int64         `json:"memory_usage_bytes"`
}

// DecisionCacheEntry represents a cached decision
type DecisionCacheEntry struct {
	Decision      bool                   `json:"decision"`
	Reason        string                 `json:"reason"`
	Result        map[string]interface{} `json:"result"`
	PolicyID      string                 `json:"policy_id"`
	TenantID      string                 `json:"tenant_id"`
	UserID        string                 `json:"user_id"`
	Resource      string                 `json:"resource"`
	Action        string                 `json:"action"`
	ExecutionTime time.Duration          `json:"execution_time"`
	CachedAt      time.Time              `json:"cached_at"`
	ExpiresAt     time.Time              `json:"expires_at"`
	TTL           time.Duration          `json:"ttl"`
	Checksum      string                 `json:"checksum"`
	Metadata      map[string]interface{} `json:"metadata"`
	Version       int                    `json:"version"`
	Tags          []string               `json:"tags"`
}

// CacheInvalidationRule defines rules for cache invalidation
type CacheInvalidationRule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Conditions  map[string]interface{} `json:"conditions"`
	Action      string                 `json:"action"`
	Priority    int                    `json:"priority"`
	Enabled     bool                   `json:"enabled"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// NewDecisionCache creates a new decision cache
func NewDecisionCache(redisClient *redis.Client, config DecisionCacheConfig, logger *logrus.Logger) *DecisionCache {
	if logger == nil {
		logger = logrus.New()
	}

	if config.KeyPrefix == "" {
		config.KeyPrefix = "opa:decision"
	}

	if config.DefaultTTL == 0 {
		config.DefaultTTL = 30 * time.Second
	}

	if config.CleanupInterval == 0 {
		config.CleanupInterval = 5 * time.Minute
	}

	cache := &DecisionCache{
		redis:     redisClient,
		logger:    logger,
		config:    config,
		metrics:   &CacheMetrics{MinLatency: time.Hour}, // Initialize with high value
		keyPrefix: config.KeyPrefix,
	}

	// Start background cleanup
	go cache.startCleanupRoutine()

	return cache
}

// Get retrieves a cached decision
func (dc *DecisionCache) Get(ctx context.Context, key string) (*DecisionCacheEntry, error) {
	startTime := time.Now()

	// Generate full cache key
	fullKey := dc.generateKey(key)

	// Get from Redis
	result, err := dc.redis.Get(ctx, fullKey).Result()
	if err != nil {
		if err == redis.Nil {
			// Cache miss
			dc.recordMiss()
			dc.logger.WithField("key", key).Debug("Cache miss")
			return nil, nil
		}
		// Error
		dc.recordError()
		dc.logger.WithError(err).WithField("key", key).Error("Cache get error")
		return nil, fmt.Errorf("failed to get from cache: %w", err)
	}

	// Deserialize entry
	var entry DecisionCacheEntry
	if err := json.Unmarshal([]byte(result), &entry); err != nil {
		dc.recordError()
		dc.logger.WithError(err).WithField("key", key).Error("Failed to deserialize cache entry")
		return nil, fmt.Errorf("failed to deserialize cache entry: %w", err)
	}

	// Check if entry is expired
	if time.Now().After(entry.ExpiresAt) {
		// Delete expired entry
		dc.Delete(ctx, key)
		dc.recordMiss()
		dc.logger.WithField("key", key).Debug("Cache entry expired")
		return nil, nil
	}

	// Record metrics
	latency := time.Since(startTime)
	dc.recordHit(latency)

	dc.logger.WithFields(logrus.Fields{
		"key":     key,
		"latency": latency,
	}).Debug("Cache hit")

	return &entry, nil
}

// Set stores a decision in cache
func (dc *DecisionCache) Set(ctx context.Context, key string, entry *DecisionCacheEntry) error {
	startTime := time.Now()

	// Set cache metadata
	entry.CachedAt = time.Now()
	if entry.TTL == 0 {
		entry.TTL = dc.config.DefaultTTL
	}
	entry.ExpiresAt = entry.CachedAt.Add(entry.TTL)
	entry.Version = 1
	entry.Checksum = dc.calculateChecksum(entry)

	// Serialize entry
	data, err := json.Marshal(entry)
	if err != nil {
		dc.recordError()
		return fmt.Errorf("failed to serialize cache entry: %w", err)
	}

	// Generate full cache key
	fullKey := dc.generateKey(key)

	// Store in Redis with TTL
	if err := dc.redis.Set(ctx, fullKey, data, entry.TTL).Err(); err != nil {
		dc.recordError()
		dc.logger.WithError(err).WithField("key", key).Error("Failed to set cache entry")
		return fmt.Errorf("failed to set cache entry: %w", err)
	}

	// Record metrics
	dc.recordSet()
	latency := time.Since(startTime)

	dc.logger.WithFields(logrus.Fields{
		"key":     key,
		"ttl":     entry.TTL,
		"latency": latency,
	}).Debug("Cache set")

	return nil
}

// Delete removes a decision from cache
func (dc *DecisionCache) Delete(ctx context.Context, key string) error {
	fullKey := dc.generateKey(key)

	if err := dc.redis.Del(ctx, fullKey).Err(); err != nil {
		dc.recordError()
		dc.logger.WithError(err).WithField("key", key).Error("Failed to delete cache entry")
		return fmt.Errorf("failed to delete cache entry: %w", err)
	}

	dc.recordDelete()
	dc.logger.WithField("key", key).Debug("Cache delete")

	return nil
}

// GetByPattern retrieves multiple cache entries by pattern
func (dc *DecisionCache) GetByPattern(ctx context.Context, pattern string) ([]*DecisionCacheEntry, error) {
	fullPattern := dc.generateKey(pattern)

	keys, err := dc.redis.Keys(ctx, fullPattern).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get keys by pattern: %w", err)
	}

	var entries []*DecisionCacheEntry
	for _, key := range keys {
		// Remove key prefix
		originalKey := strings.TrimPrefix(key, dc.keyPrefix+":")

		entry, err := dc.Get(ctx, originalKey)
		if err != nil {
			dc.logger.WithError(err).WithField("key", originalKey).Warn("Failed to get cache entry")
			continue
		}

		if entry != nil {
			entries = append(entries, entry)
		}
	}

	return entries, nil
}

// InvalidateByTenant invalidates all cache entries for a tenant
func (dc *DecisionCache) InvalidateByTenant(ctx context.Context, tenantID string) error {
	pattern := fmt.Sprintf("*:tenant:%s:*", tenantID)

	entries, err := dc.GetByPattern(ctx, pattern)
	if err != nil {
		return fmt.Errorf("failed to get tenant cache entries: %w", err)
	}

	for _, entry := range entries {
		key := dc.generateEntryKey(entry)
		if err := dc.Delete(ctx, key); err != nil {
			dc.logger.WithError(err).WithField("key", key).Warn("Failed to invalidate cache entry")
		}
	}

	dc.logger.WithFields(logrus.Fields{
		"tenant_id": tenantID,
		"count":     len(entries),
	}).Info("Invalidated tenant cache entries")

	return nil
}

// InvalidateByPolicy invalidates all cache entries for a policy
func (dc *DecisionCache) InvalidateByPolicy(ctx context.Context, policyID string) error {
	pattern := fmt.Sprintf("*:policy:%s:*", policyID)

	entries, err := dc.GetByPattern(ctx, pattern)
	if err != nil {
		return fmt.Errorf("failed to get policy cache entries: %w", err)
	}

	for _, entry := range entries {
		key := dc.generateEntryKey(entry)
		if err := dc.Delete(ctx, key); err != nil {
			dc.logger.WithError(err).WithField("key", key).Warn("Failed to invalidate cache entry")
		}
	}

	dc.logger.WithFields(logrus.Fields{
		"policy_id": policyID,
		"count":     len(entries),
	}).Info("Invalidated policy cache entries")

	return nil
}

// InvalidateByUser invalidates all cache entries for a user
func (dc *DecisionCache) InvalidateByUser(ctx context.Context, userID string) error {
	pattern := fmt.Sprintf("*:user:%s:*", userID)

	entries, err := dc.GetByPattern(ctx, pattern)
	if err != nil {
		return fmt.Errorf("failed to get user cache entries: %w", err)
	}

	for _, entry := range entries {
		key := dc.generateEntryKey(entry)
		if err := dc.Delete(ctx, key); err != nil {
			dc.logger.WithError(err).WithField("key", key).Warn("Failed to invalidate cache entry")
		}
	}

	dc.logger.WithFields(logrus.Fields{
		"user_id": userID,
		"count":   len(entries),
	}).Info("Invalidated user cache entries")

	return nil
}

// GetMetrics returns cache metrics
func (dc *DecisionCache) GetMetrics() *CacheMetrics {
	// Calculate cache size and memory usage
	ctx := context.Background()
	keys, _ := dc.redis.Keys(ctx, dc.generateKey("*")).Result()

	metrics := *dc.metrics
	metrics.CacheSize = int64(len(keys))

	// Calculate hit ratio
	if metrics.Hits+metrics.Misses > 0 {
		// Additional metrics could be calculated here
	}

	return &metrics
}

// ResetMetrics resets cache metrics
func (dc *DecisionCache) ResetMetrics() {
	dc.metrics = &CacheMetrics{MinLatency: time.Hour}
}

// Clear clears all cache entries
func (dc *DecisionCache) Clear(ctx context.Context) error {
	pattern := dc.generateKey("*")

	keys, err := dc.redis.Keys(ctx, pattern).Result()
	if err != nil {
		return fmt.Errorf("failed to get all cache keys: %w", err)
	}

	if len(keys) > 0 {
		if err := dc.redis.Del(ctx, keys...).Err(); err != nil {
			return fmt.Errorf("failed to clear cache: %w", err)
		}
	}

	dc.logger.WithField("count", len(keys)).Info("Cleared all cache entries")
	return nil
}

// Private methods

func (dc *DecisionCache) generateKey(key string) string {
	return fmt.Sprintf("%s:%s", dc.keyPrefix, key)
}

func (dc *DecisionCache) generateEntryKey(entry *DecisionCacheEntry) string {
	return fmt.Sprintf("%s:%s:%s:%s:%s:%s",
		entry.PolicyID,
		entry.TenantID,
		entry.UserID,
		entry.Resource,
		entry.Action,
		dc.hashInput(entry),
	)
}

func (dc *DecisionCache) hashInput(entry *DecisionCacheEntry) string {
	// Create hash of input data for uniqueness
	inputData := map[string]interface{}{
		"policy_id": entry.PolicyID,
		"tenant_id": entry.TenantID,
		"user_id":   entry.UserID,
		"resource":  entry.Resource,
		"action":    entry.Action,
	}

	data, _ := json.Marshal(inputData)
	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash[:8]) // Use first 8 bytes
}

func (dc *DecisionCache) calculateChecksum(entry *DecisionCacheEntry) string {
	data, _ := json.Marshal(entry)
	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash[:16]) // Use first 16 bytes
}

func (dc *DecisionCache) recordHit(latency time.Duration) {
	if !dc.config.EnableMetrics {
		return
	}

	dc.metrics.Hits++
	dc.metrics.LastHit = time.Now()
	dc.metrics.TotalLatency += latency

	// Update average latency
	if dc.metrics.Hits > 0 {
		dc.metrics.AvgLatency = dc.metrics.TotalLatency / time.Duration(dc.metrics.Hits)
	}

	// Update min/max latency
	if latency < dc.metrics.MinLatency {
		dc.metrics.MinLatency = latency
	}
	if latency > dc.metrics.MaxLatency {
		dc.metrics.MaxLatency = latency
	}
}

func (dc *DecisionCache) recordMiss() {
	if !dc.config.EnableMetrics {
		return
	}
	dc.metrics.Misses++
	dc.metrics.LastMiss = time.Now()
}

func (dc *DecisionCache) recordSet() {
	if !dc.config.EnableMetrics {
		return
	}
	dc.metrics.Sets++
}

func (dc *DecisionCache) recordDelete() {
	if !dc.config.EnableMetrics {
		return
	}
	dc.metrics.Deletes++
}

func (dc *DecisionCache) recordError() {
	if !dc.config.EnableMetrics {
		return
	}
	dc.metrics.Errors++
}

func (dc *DecisionCache) startCleanupRoutine() {
	ticker := time.NewTicker(dc.config.CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		dc.cleanupExpiredEntries()
	}
}

func (dc *DecisionCache) cleanupExpiredEntries() {
	ctx := context.Background()

	// Get all keys
	keys, err := dc.redis.Keys(ctx, dc.generateKey("*")).Result()
	if err != nil {
		dc.logger.WithError(err).Error("Failed to get keys for cleanup")
		return
	}

	cleaned := 0
	for _, key := range keys {
		// Get TTL
		ttl, err := dc.redis.TTL(ctx, key).Result()
		if err != nil {
			continue
		}

		// If TTL is -1 (no expiration) or very short, clean it up
		if ttl == -1 || ttl < time.Second {
			if err := dc.redis.Del(ctx, key).Err(); err == nil {
				cleaned++
			}
		}
	}

	if cleaned > 0 {
		dc.logger.WithField("cleaned", cleaned).Info("Cleaned up expired cache entries")
	}
}

// Cache key generation helpers

// GeneratePolicyKey generates a cache key for policy evaluation
func GeneratePolicyKey(tenantID, userID, policyID, resource, action string, inputData map[string]interface{}) string {
	// Create input hash
	inputHash := hashInputData(inputData)

	return fmt.Sprintf("policy:%s:tenant:%s:user:%s:policy:%s:resource:%s:action:%s:input:%s",
		uuid.New().String()[:8], // Unique identifier
		tenantID,
		userID,
		policyID,
		resource,
		action,
		inputHash,
	)
}

// GenerateAuthKey generates a cache key for authentication
func GenerateAuthKey(userID, sessionID, tokenID, clientIP string) string {
	return fmt.Sprintf("auth:tenant:all:user:%s:session:%s:token:%s:ip:%s",
		userID,
		sessionID,
		tokenID,
		clientIP,
	)
}

// GenerateDLPKey generates a cache key for DLP evaluation
func GenerateDLPKey(tenantID, userID, contentHash, purpose string) string {
	return fmt.Sprintf("dlp:tenant:%s:user:%s:content:%s:purpose:%s",
		tenantID,
		userID,
		contentHash,
		purpose,
	)
}

// Helper function to hash input data
func hashInputData(input map[string]interface{}) string {
	data, _ := json.Marshal(input)
	hash := sha256.Sum256(data)
	return fmt.Sprintf("%x", hash[:8]) // Use first 8 bytes
}
