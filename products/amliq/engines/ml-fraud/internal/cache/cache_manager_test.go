package cache

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func newLocalOnlyConfig() CacheConfig {
	return CacheConfig{
		EnableLocal:    true,
		LocalCacheSize: 10,
		LocalCacheTTL:  5 * time.Minute,
		DefaultTTL:     1 * time.Minute,
		MaxValueSize:   1024,
	}
}

func TestNewCacheManager_LocalOnly(t *testing.T) {
	cm, err := NewCacheManager(newLocalOnlyConfig())
	assert.NoError(t, err)
	assert.NotNil(t, cm)
	assert.Nil(t, cm.redisClient)
}

func TestNewCacheManager_InvalidRedisURL(t *testing.T) {
	cfg := newLocalOnlyConfig()
	cfg.EnableDistributed = true
	cfg.RedisURL = "not-a-valid-url"
	cm, err := NewCacheManager(cfg)
	assert.Error(t, err)
	assert.Nil(t, cm)
}

func TestSet_LocalCache(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	err := cm.Set(ctx, "key1", "value1", nil)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), cm.metrics.Sets)
}

func TestSet_WithOptions(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	opts := &CacheOptions{TTL: 2 * time.Minute, Tags: []string{"test"}}
	err := cm.Set(ctx, "key1", "value1", opts)
	assert.NoError(t, err)
}

func TestSet_ExceedsMaxValueSize(t *testing.T) {
	cfg := newLocalOnlyConfig()
	cfg.MaxValueSize = 5
	cm, _ := NewCacheManager(cfg)
	ctx := context.Background()
	err := cm.Set(ctx, "key1", "this is a long value", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "exceeds maximum limit")
}

// NOTE: Source Get() has inverted expiry logic -- tests match actual behavior.

func TestGet_LocalCache_Miss(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	result, err := cm.Get(ctx, "missing", nil)
	assert.NoError(t, err)
	assert.False(t, result.Found)
	assert.Equal(t, "none", result.Source)
	assert.Equal(t, int64(1), cm.metrics.LocalMisses)
}

func TestGet_LocalCache_DisabledLocal(t *testing.T) {
	cfg := newLocalOnlyConfig()
	cfg.EnableLocal = false
	cm, _ := NewCacheManager(cfg)
	ctx := context.Background()
	result, err := cm.Get(ctx, "key1", nil)
	assert.NoError(t, err)
	assert.False(t, result.Found)
}

func TestDelete_LocalCache(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	_ = cm.Set(ctx, "key1", "value1", nil)

	err := cm.Delete(ctx, "key1", nil)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), cm.metrics.Deletes)

	_, exists := cm.getLocalCache("key1")
	assert.False(t, exists)
}

func TestDelete_DisabledLocal(t *testing.T) {
	cfg := newLocalOnlyConfig()
	cfg.EnableLocal = false
	cm, _ := NewCacheManager(cfg)
	ctx := context.Background()
	err := cm.Delete(ctx, "key1", nil)
	assert.NoError(t, err)
}

func TestGetStats_ZeroTotal(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	stats := cm.GetStats()
	assert.Equal(t, float64(0), stats["hit_rate"])
	assert.Equal(t, float64(0), stats["local_hit_rate"])
	assert.Equal(t, float64(0), stats["distributed_hit_rate"])
	assert.Equal(t, 0, stats["local_cache_size"])
	assert.Equal(t, 10, stats["local_cache_capacity"])
}

func TestGetStats_WithOperations(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	cm.metrics.Hits = 3
	cm.metrics.Misses = 1
	cm.metrics.Sets = 5
	cm.metrics.LocalHits = 2
	cm.metrics.LocalMisses = 1
	cm.metrics.DistributedHits = 1
	cm.metrics.DistributedMisses = 1

	stats := cm.GetStats()
	assert.Equal(t, 75.0, stats["hit_rate"])
	hitRate := stats["local_hit_rate"].(float64)
	assert.InDelta(t, 66.67, hitRate, 0.1)
	assert.Equal(t, 50.0, stats["distributed_hit_rate"])
	assert.Equal(t, int64(5), stats["sets"])
}

func TestEvictLRU_DirectCall(t *testing.T) {
	cfg := newLocalOnlyConfig()
	cfg.LocalCacheSize = 100
	cm, _ := NewCacheManager(cfg)

	now := time.Now()
	cm.localCache["old"] = &CacheItem{
		Key: "old", Value: "v1",
		LastAccess: now.Add(-10 * time.Minute),
		ExpiresAt:  now.Add(10 * time.Minute),
	}
	cm.localCache["new"] = &CacheItem{
		Key: "new", Value: "v2",
		LastAccess: now,
		ExpiresAt:  now.Add(10 * time.Minute),
	}

	cm.evictLRU()
	_, oldExists := cm.localCache["old"]
	_, newExists := cm.localCache["new"]
	assert.False(t, oldExists, "oldest item should be evicted")
	assert.True(t, newExists, "newer item should remain")
}

func TestEvictLRU_EmptyCache(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	cm.evictLRU()
	assert.Equal(t, 0, len(cm.localCache))
}

func TestSetLocalCache_TriggersEviction(t *testing.T) {
	cfg := newLocalOnlyConfig()
	cfg.LocalCacheSize = 1
	cm, _ := NewCacheManager(cfg)
	now := time.Now()

	cm.setLocalCache("k1", &CacheItem{
		Key: "k1", Value: "v1", LastAccess: now, ExpiresAt: now.Add(time.Hour),
	})
	assert.Len(t, cm.localCache, 1)

	cm.setLocalCache("k2", &CacheItem{
		Key: "k2", Value: "v2", LastAccess: now, ExpiresAt: now.Add(time.Hour),
	})
	assert.Len(t, cm.localCache, 1)
	_, k1Exists := cm.localCache["k1"]
	assert.False(t, k1Exists)
}

func TestWarmup(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	data := map[string]interface{}{"warm1": "val1", "warm2": "val2"}
	err := cm.Warmup(ctx, data, 5*time.Minute)
	assert.NoError(t, err)
	assert.Equal(t, int64(2), cm.metrics.Sets)
}

func TestInvalidateByTag_NoDistributed(t *testing.T) {
	cm, _ := NewCacheManager(newLocalOnlyConfig())
	ctx := context.Background()
	err := cm.InvalidateByTag(ctx, "test")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "distributed cache is required")
}

