package cache

import (
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// RateLimitCache implements an in-memory cache for rate limiting data
type RateLimitCache struct {
	items  map[string]*cacheItem
	mutex  sync.RWMutex
	logger *logrus.Logger
	stats  CacheStats
}

// cacheItem represents a cached item
type cacheItem struct {
	value     interface{}
	expiresAt time.Time
	createdAt time.Time
	size      int64
}

// CacheStats provides cache statistics
type CacheStats struct {
	Hits        int64   `json:"hits"`
	Misses      int64   `json:"misses"`
	HitRate     float64 `json:"hit_rate"`
	TotalKeys   int64   `json:"total_keys"`
	MemoryUsage int64   `json:"memory_usage"`
}

// NewRateLimitCache creates a new rate limit cache
func NewRateLimitCache(logger *logrus.Logger) *RateLimitCache {
	cache := &RateLimitCache{
		items:  make(map[string]*cacheItem),
		logger: logger,
	}

	// Start cleanup goroutine
	go cache.startCleanup()

	return cache
}

// Get retrieves a value from the cache
func (c *RateLimitCache) Get(key string) (interface{}, bool) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	item, exists := c.items[key]
	if !exists {
		c.stats.Misses++
		c.updateHitRate()
		return nil, false
	}

	// Check if item has expired
	if time.Now().After(item.expiresAt) {
		c.mutex.RUnlock()
		c.mutex.Lock()
		delete(c.items, key)
		c.stats.TotalKeys--
		c.stats.MemoryUsage -= item.size
		c.mutex.Unlock()
		c.mutex.RLock()

		c.stats.Misses++
		c.updateHitRate()
		return nil, false
	}

	c.stats.Hits++
	c.updateHitRate()

	// Update access time (optional optimization)
	item.expiresAt = time.Now().Add(time.Until(item.expiresAt))

	return item.value, true
}

// Set stores a value in the cache
func (c *RateLimitCache) Set(key string, value interface{}, ttl time.Duration) {
	if ttl <= 0 {
		return
	}

	c.mutex.Lock()
	defer c.mutex.Unlock()

	// Calculate item size (rough estimation)
	size := int64(estimateSize(value))

	// Remove existing item if it exists
	if existingItem, exists := c.items[key]; exists {
		c.stats.TotalKeys--
		c.stats.MemoryUsage -= existingItem.size
	}

	// Add new item
	c.items[key] = &cacheItem{
		value:     value,
		expiresAt: time.Now().Add(ttl),
		createdAt: time.Now(),
		size:      size,
	}

	c.stats.TotalKeys++
	c.stats.MemoryUsage += size
}

// Delete removes a value from the cache
func (c *RateLimitCache) Delete(key string) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if item, exists := c.items[key]; exists {
		delete(c.items, key)
		c.stats.TotalKeys--
		c.stats.MemoryUsage -= item.size
	}
}

// Clear removes all items from the cache
func (c *RateLimitCache) Clear() {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.items = make(map[string]*cacheItem)
	c.stats = CacheStats{}
}

// Stats returns cache statistics
func (c *RateLimitCache) Stats() CacheStats {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	return c.stats
}

// Cleanup removes expired items from the cache
func (c *RateLimitCache) Cleanup() {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	now := time.Now()
	for key, item := range c.items {
		if now.After(item.expiresAt) {
			delete(c.items, key)
			c.stats.TotalKeys--
			c.stats.MemoryUsage -= item.size
		}
	}
}

// SetMaxSize sets a maximum memory usage limit (in bytes)
func (c *RateLimitCache) SetMaxSize(maxSize int64) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	// If current usage is under limit, nothing to do
	if c.stats.MemoryUsage <= maxSize {
		return
	}

	// Remove least recently used items until under limit
	for c.stats.MemoryUsage > maxSize && len(c.items) > 0 {
		var oldestKey string
		var oldestTime time.Time
		first := true

		for key, item := range c.items {
			if first || item.createdAt.Before(oldestTime) {
				oldestKey = key
				oldestTime = item.createdAt
				first = false
			}
		}

		if oldestKey != "" {
			item := c.items[oldestKey]
			delete(c.items, oldestKey)
			c.stats.TotalKeys--
			c.stats.MemoryUsage -= item.size
		}
	}
}

// GetItemsByPrefix returns all items with keys matching the prefix
func (c *RateLimitCache) GetItemsByPrefix(prefix string) map[string]interface{} {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	result := make(map[string]interface{})
	now := time.Now()

	for key, item := range c.items {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			if now.Before(item.expiresAt) {
				result[key] = item.value
			}
		}
	}

	return result
}

// DeleteByPrefix removes all items with keys matching the prefix
func (c *RateLimitCache) DeleteByPrefix(prefix string) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	for key, item := range c.items {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			delete(c.items, key)
			c.stats.TotalKeys--
			c.stats.MemoryUsage -= item.size
		}
	}
}

// startCleanup runs cleanup every minute
func (c *RateLimitCache) startCleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		c.Cleanup()
	}
}

// updateHitRate updates the hit rate calculation
func (c *RateLimitCache) updateHitRate() {
	total := c.stats.Hits + c.stats.Misses
	if total > 0 {
		c.stats.HitRate = float64(c.stats.Hits) / float64(total)
	}
}

// estimateSize provides a rough estimation of the size of a value
func estimateSize(value interface{}) int64 {
	switch v := value.(type) {
	case string:
		return int64(len(v))
	case []byte:
		return int64(len(v))
	case int, int8, int16, int32, int64:
		return 8
	case uint, uint8, uint16, uint32, uint64:
		return 8
	case float32, float64:
		return 8
	case bool:
		return 1
	default:
		// For complex types, use a reasonable estimate
		return 100
	}
}
