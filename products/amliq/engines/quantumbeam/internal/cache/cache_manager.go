//go:build legacy_migrated
// +build legacy_migrated

package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// CacheManager provides comprehensive caching capabilities
type CacheManager struct {
	logger       *log.Logger
	redisClient  *redis.Client
	localCache   map[string]*CacheItem
	localCacheMu sync.RWMutex
	config       CacheConfig
	metrics      *CacheMetrics
}

// CacheConfig holds cache configuration
type CacheConfig struct {
	RedisURL              string        `json:"redis_url"`
	DefaultTTL            time.Duration `json:"default_ttl"`
	LocalCacheSize        int           `json:"local_cache_size"`
	LocalCacheTTL         time.Duration `json:"local_cache_ttl"`
	EnableDistributed     bool          `json:"enable_distributed"`
	EnableLocal           bool          `json:"enable_local"`
	CacheInvalidation     string        `json:"cache_invalidation"`
	CompressionEnabled    bool          `json:"compression_enabled"`
	SerializationFormat   string        `json:"serialization_format"`
	MaxValueSize          int64         `json:"max_value_size"`
	CircuitBreakerEnabled bool          `json:"circuit_breaker_enabled"`
}

// CacheItem represents a cached item
type CacheItem struct {
	Key         string                 `json:"key"`
	Value       interface{}            `json:"value"`
	TTL         time.Duration          `json:"ttl"`
	CreatedAt   time.Time              `json:"created_at"`
	ExpiresAt   time.Time              `json:"expires_at"`
	AccessCount int                    `json:"access_count"`
	LastAccess  time.Time              `json:"last_access"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// CacheMetrics tracks cache performance
type CacheMetrics struct {
	Hits              int64 `json:"hits"`
	Misses            int64 `json:"misses"`
	Sets              int64 `json:"sets"`
	Deletes           int64 `json:"deletes"`
	Errors            int64 `json:"errors"`
	LocalHits         int64 `json:"local_hits"`
	LocalMisses       int64 `json:"local_misses"`
	DistributedHits   int64 `json:"distributed_hits"`
	DistributedMisses int64 `json:"distributed_misses"`
}

// CacheKey represents a cache key with metadata
type CacheKey struct {
	Key      string            `json:"key"`
	Tags     []string          `json:"tags"`
	Prefix   string            `json:"prefix"`
	Version  string            `json:"version"`
	Metadata map[string]string `json:"metadata"`
}

// CacheOptions provides options for cache operations
type CacheOptions struct {
	TTL          time.Duration `json:"ttl"`
	Tags         []string      `json:"tags"`
	Compression  bool          `json:"compression"`
	SerializeAs  string        `json:"serialize_as"`
	InvalidateOn []string      `json:"invalidate_on"`
	Priority     int           `json:"priority"`
	Dependencies []string      `json:"dependencies"`
}

// CacheResult represents the result of a cache operation
type CacheResult struct {
	Found    bool                   `json:"found"`
	Value    interface{}            `json:"value"`
	Source   string                 `json:"source"` // "local", "distributed", "database"
	Hit      bool                   `json:"hit"`
	TTL      time.Duration          `json:"ttl"`
	Error    error                  `json:"error,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// NewCacheManager creates a new cache manager
func NewCacheManager(config CacheConfig) (*CacheManager, error) {
	cm := &CacheManager{
		logger:     log.New(log.Writer(), "[CACHE-MANAGER] ", log.LstdFlags|log.Lmsgprefix),
		config:     config,
		localCache: make(map[string]*CacheItem, config.LocalCacheSize),
		metrics:    &CacheMetrics{},
	}

	// Initialize Redis client if distributed caching is enabled
	if config.EnableDistributed && config.RedisURL != "" {
		opt, err := redis.ParseURL(config.RedisURL)
		if err != nil {
			return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
		}

		cm.redisClient = redis.NewClient(opt)

		// Test Redis connection
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := cm.redisClient.Ping(ctx).Err(); err != nil {
			return nil, fmt.Errorf("failed to connect to Redis: %w", err)
		}

		cm.logger.Println("Connected to Redis successfully")
	}

	// Start cleanup goroutine for local cache
	go cm.cleanupLocalCache()

	return cm, nil
}

// Set stores a value in the cache
func (cm *CacheManager) Set(ctx context.Context, key string, value interface{}, options *CacheOptions) error {
	if options == nil {
		options = &CacheOptions{
			TTL: cm.config.DefaultTTL,
		}
	}

	// Check value size
	if cm.config.MaxValueSize > 0 {
		if serialized, err := json.Marshal(value); err == nil {
			if int64(len(serialized)) > cm.config.MaxValueSize {
				return fmt.Errorf("value size exceeds maximum limit")
			}
		}
	}

	cacheItem := &CacheItem{
		Key:         key,
		Value:       value,
		TTL:         options.TTL,
		CreatedAt:   time.Now(),
		ExpiresAt:   time.Now().Add(options.TTL),
		AccessCount: 0,
		LastAccess:  time.Now(),
		Metadata:    make(map[string]interface{}),
	}

	// Store in local cache if enabled
	if cm.config.EnableLocal {
		cm.setLocalCache(key, cacheItem)
	}

	// Store in distributed cache if enabled
	if cm.config.EnableDistributed {
		if err := cm.setDistributedCache(ctx, key, cacheItem, options); err != nil {
			cm.logger.Printf("Failed to set distributed cache for key %s: %v", key, err)
			return err
		}
	}

	cm.metrics.Sets++
	return nil
}

// Get retrieves a value from the cache
func (cm *CacheManager) Get(ctx context.Context, key string, options *CacheOptions) (*CacheResult, error) {
	result := &CacheResult{
		Found:   false,
		Source:  "none",
		Hit:     false,
		Options: options,
	}

	// Try local cache first
	if cm.config.EnableLocal {
		if item, found := cm.getLocalCache(key); found {
			if !item.ExpiresAt.Before(time.Now()) {
				// Item is expired
				cm.deleteLocalCache(key)
			} else {
				result.Found = true
				result.Value = item.Value
				result.Source = "local"
				result.Hit = true
				result.TTL = time.Until(item.ExpiresAt)
				result.Metadata = item.Metadata

				// Update access metrics
				item.AccessCount++
				item.LastAccess = time.Now()

				cm.metrics.Hits++
				cm.metrics.LocalHits++
				return result, nil
			}
		} else {
			cm.metrics.Misses++
			cm.metrics.LocalMisses++
		}
	}

	// Try distributed cache
	if cm.config.EnableDistributed {
		item, err := cm.getDistributedCache(ctx, key, options)
		if err != nil {
			cm.metrics.Errors++
			return nil, fmt.Errorf("failed to get from distributed cache: %w", err)
		}

		if item != nil {
			result.Found = true
			result.Value = item.Value
			result.Source = "distributed"
			result.Hit = true
			result.TTL = time.Until(item.ExpiresAt)
			result.Metadata = item.Metadata

			// Cache in local cache
			if cm.config.EnableLocal {
				cm.setLocalCache(key, item)
			}

			cm.metrics.Hits++
			cm.metrics.DistributedHits++
			return result, nil
		} else {
			cm.metrics.Misses++
			cm.metrics.DistributedMisses++
		}
	}

	return result, nil
}

// Delete removes a value from the cache
func (cm *CacheManager) Delete(ctx context.Context, key string, options *CacheOptions) error {
	// Delete from local cache
	if cm.config.EnableLocal {
		cm.deleteLocalCache(key)
	}

	// Delete from distributed cache
	if cm.config.EnableDistributed {
		if err := cm.deleteDistributedCache(ctx, key, options); err != nil {
			cm.logger.Printf("Failed to delete from distributed cache for key %s: %v", key, err)
			return err
		}
	}

	cm.metrics.Deletes++
	return nil
}

// InvalidateByTag invalidates all cache entries with the specified tag
func (cm *CacheManager) InvalidateByTag(ctx context.Context, tag string) error {
	if !cm.config.EnableDistributed {
		return fmt.Errorf("distributed cache is required for tag invalidation")
	}

	// This would require a more sophisticated implementation
	// For now, we'll implement a simple Redis-based solution
	pattern := fmt.Sprintf("tag:%s:*", tag)

	keys, err := cm.redisClient.Keys(ctx, pattern).Result()
	if err != nil {
		return fmt.Errorf("failed to get keys for tag invalidation: %w", err)
	}

	if len(keys) > 0 {
		if err := cm.redisClient.Del(ctx, keys...).Err(); err != nil {
			return fmt.Errorf("failed to delete keys for tag invalidation: %w", err)
		}
	}

	cm.logger.Printf("Invalidated %d cache entries with tag: %s", len(keys), tag)
	return nil
}

// GetStats returns cache statistics
func (cm *CacheManager) GetStats() map[string]interface{} {
	cm.localCacheMu.RLock()
	localCacheSize := len(cm.localCache)
	cm.localCacheMu.RUnlock()

	hitRate := float64(0)
	total := cm.metrics.Hits + cm.metrics.Misses
	if total > 0 {
		hitRate = float64(cm.metrics.Hits) / float64(total) * 100
	}

	localHitRate := float64(0)
	localTotal := cm.metrics.LocalHits + cm.metrics.LocalMisses
	if localTotal > 0 {
		localHitRate = float64(cm.metrics.LocalHits) / float64(localTotal) * 100
	}

	distributedHitRate := float64(0)
	distributedTotal := cm.metrics.DistributedHits + cm.metrics.DistributedMisses
	if distributedTotal > 0 {
		distributedHitRate = float64(cm.metrics.DistributedHits) / float64(distributedTotal) * 100
	}

	return map[string]interface{}{
		"hits":                 cm.metrics.Hits,
		"misses":               cm.metrics.Misses,
		"sets":                 cm.metrics.Sets,
		"deletes":              cm.metrics.Deletes,
		"errors":               cm.metrics.Errors,
		"hit_rate":             hitRate,
		"local_hits":           cm.metrics.LocalHits,
		"local_misses":         cm.metrics.LocalMisses,
		"local_hit_rate":       localHitRate,
		"distributed_hits":     cm.metrics.DistributedHits,
		"distributed_misses":   cm.metrics.DistributedMisses,
		"distributed_hit_rate": distributedHitRate,
		"local_cache_size":     localCacheSize,
		"local_cache_capacity": cm.config.LocalCacheSize,
	}
}

// Warmup preloads the cache with common data
func (cm *CacheManager) Warmup(ctx context.Context, warmupData map[string]interface{}, ttl time.Duration) error {
	for key, value := range warmupData {
		options := &CacheOptions{
			TTL:  ttl,
			Tags: []string{"warmup"},
		}

		if err := cm.Set(ctx, key, value, options); err != nil {
			cm.logger.Printf("Failed to warmup cache for key %s: %v", key, err)
			continue
		}
	}

	cm.logger.Printf("Cache warmup completed. Preloaded %d items", len(warmupData))
	return nil
}

// Local cache methods

func (cm *CacheManager) setLocalCache(key string, item *CacheItem) {
	cm.localCacheMu.Lock()
	defer cm.localCacheMu.Unlock()

	// Check if cache is full
	if len(cm.localCache) >= cm.config.LocalCacheSize {
		cm.evictLRU()
	}

	cm.localCache[key] = item
}

func (cm *CacheManager) getLocalCache(key string) (*CacheItem, bool) {
	cm.localCacheMu.RLock()
	defer cm.localCacheMu.RUnlock()

	item, exists := cm.localCache[key]
	return item, exists
}

func (cm *CacheManager) deleteLocalCache(key string) {
	cm.localCacheMu.Lock()
	defer cm.localCacheMu.Unlock()

	delete(cm.localCache, key)
}

func (cm *CacheManager) evictLRU() {
	var oldestKey string
	var oldestTime time.Time
	first := true

	for key, item := range cm.localCache {
		if first || item.LastAccess.Before(oldestTime) {
			oldestKey = key
			oldestTime = item.LastAccess
			first = false
		}
	}

	if oldestKey != "" {
		delete(cm.localCache, oldestKey)
	}
}

func (cm *CacheManager) cleanupLocalCache() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		cm.localCacheMu.Lock()
		for key, item := range cm.localCache {
			if item.ExpiresAt.Before(time.Now()) {
				delete(cm.localCache, key)
			}
		}
		cm.localCacheMu.Unlock()
	}
}

// Distributed cache methods

func (cm *CacheManager) setDistributedCache(ctx context.Context, key string, item *CacheItem, options *CacheOptions) error {
	// Serialize the item
	data, err := json.Marshal(item)
	if err != nil {
		return fmt.Errorf("failed to serialize cache item: %w", err)
	}

	// Apply compression if enabled
	if options.Compression || cm.config.CompressionEnabled {
		// In a real implementation, you would compress the data here
	}

	// Store in Redis with TTL
	if err := cm.redisClient.Set(ctx, key, data, options.TTL).Err(); err != nil {
		return fmt.Errorf("failed to set Redis cache: %w", err)
	}

	// Store tags if provided
	if len(options.Tags) > 0 {
		for _, tag := range options.Tags {
			tagKey := fmt.Sprintf("tag:%s:%s", tag, key)
			if err := cm.redisClient.Set(ctx, tagKey, "1", options.TTL).Err(); err != nil {
				cm.logger.Printf("Failed to set tag %s for key %s: %v", tag, key, err)
			}
		}
	}

	return nil
}

func (cm *CacheManager) getDistributedCache(ctx context.Context, key string, options *CacheOptions) (*CacheItem, error) {
	data, err := cm.redisClient.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Key not found
		}
		return nil, fmt.Errorf("failed to get Redis cache: %w", err)
	}

	var item CacheItem
	if err := json.Unmarshal([]byte(data), &item); err != nil {
		return nil, fmt.Errorf("failed to deserialize cache item: %w", err)
	}

	// Check if item is expired
	if item.ExpiresAt.Before(time.Now()) {
		// Delete expired item
		cm.redisClient.Del(ctx, key)
		return nil, nil
	}

	return &item, nil
}

func (cm *CacheManager) deleteDistributedCache(ctx context.Context, key string, options *CacheOptions) error {
	if err := cm.redisClient.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to delete from Redis cache: %w", err)
	}

	// Delete tag associations
	pattern := fmt.Sprintf("tag:*:%s", key)
	keys, err := cm.redisClient.Keys(ctx, pattern).Result()
	if err != nil {
		cm.logger.Printf("Failed to get tag keys for deletion: %v", err)
	} else if len(keys) > 0 {
		cm.redisClient.Del(ctx, keys...)
	}

	return nil
}

// Business-specific cache methods

// CacheTransactionResult caches fraud detection results
func (cm *CacheManager) CacheTransactionResult(ctx context.Context, transactionID string, result interface{}, options *CacheOptions) error {
	key := fmt.Sprintf("transaction:%s", transactionID)

	if options == nil {
		options = &CacheOptions{
			TTL:  1 * time.Hour,
			Tags: []string{"transaction", "fraud_detection"},
		}
	}

	return cm.Set(ctx, key, result, options)
}

// GetTransactionResult retrieves cached fraud detection results
func (cm *CacheManager) GetTransactionResult(ctx context.Context, transactionID string, options *CacheOptions) (*CacheResult, error) {
	key := fmt.Sprintf("transaction:%s", transactionID)
	return cm.Get(ctx, key, options)
}

// CacheQuantumResult caches quantum processing results
func (cm *CacheManager) CacheQuantumResult(ctx context.Context, algorithm string, inputHash string, result interface{}, options *CacheOptions) error {
	key := fmt.Sprintf("quantum:%s:%s", algorithm, inputHash)

	if options == nil {
		options = &CacheOptions{
			TTL:  30 * time.Minute,
			Tags: []string{"quantum", "processing"},
		}
	}

	return cm.Set(ctx, key, result, options)
}

// GetQuantumResult retrieves cached quantum processing results
func (cm *CacheManager) GetQuantumResult(ctx context.Context, algorithm string, inputHash string, options *CacheOptions) (*CacheResult, error) {
	key := fmt.Sprintf("quantum:%s:%s", algorithm, inputHash)
	return cm.Get(ctx, key, options)
}

// CacheModelResult caches AI/ML model results
func (cm *CacheManager) CacheModelResult(ctx context.Context, modelType string, inputHash string, result interface{}, options *CacheOptions) error {
	key := fmt.Sprintf("model:%s:%s", modelType, inputHash)

	if options == nil {
		options = &CacheOptions{
			TTL:  15 * time.Minute,
			Tags: []string{"model", "ai", "ml"},
		}
	}

	return cm.Set(ctx, key, result, options)
}

// GetModelResult retrieves cached AI/ML model results
func (cm *CacheManager) GetModelResult(ctx context.Context, modelType string, inputHash string, options *CacheOptions) (*CacheResult, error) {
	key := fmt.Sprintf("model:%s:%s", modelType, inputHash)
	return cm.Get(ctx, key, options)
}

// GenerateHash generates a hash for cache keys
func GenerateHash(input string) string {
	hash := sha256.Sum256([]byte(input))
	return hex.EncodeToString(hash[:]) // Use first 16 characters
}

// CacheKeyBuilder helps build complex cache keys
type CacheKeyBuilder struct {
	parts []string
	tags  []string
}

func NewCacheKeyBuilder() *CacheKeyBuilder {
	return &CacheKeyBuilder{}
}

func (ckb *CacheKeyBuilder) Add(part string) *CacheKeyBuilder {
	ckb.parts = append(ckb.parts, part)
	return ckb
}

func (ckb *CacheKeyBuilder) AddTag(tag string) *CacheKeyBuilder {
	ckb.tags = append(ckb.tags, tag)
	return ckb
}

func (ckb *CacheKeyBuilder) Build() string {
	return strings.Join(ckb.parts, ":")
}

func (ckb *CacheKeyBuilder) BuildWithTimestamp() string {
	return fmt.Sprintf("%s:%d", ckb.Build(), time.Now().Unix())
}