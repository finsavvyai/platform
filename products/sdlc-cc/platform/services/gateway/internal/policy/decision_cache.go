package policy

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"
)

// DecisionCache provides caching for policy decisions
type DecisionCache struct {
	mu      sync.RWMutex
	cache   map[string]*cacheEntry
	maxSize int
}

// cacheEntry represents a cached decision
type cacheEntry struct {
	decision *PolicyDecision
	expiry   time.Time
}

// NewDecisionCache creates a new decision cache
func NewDecisionCache(maxSize int, ttl time.Duration) *DecisionCache {
	cache := &DecisionCache{
		cache:   make(map[string]*cacheEntry),
		maxSize: maxSize,
	}

	// Start cleanup goroutine
	go cache.cleanup(ttl)

	return cache
}

// Get retrieves a decision from cache
func (c *DecisionCache) Get(key string) (*PolicyDecision, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.cache[key]
	if !exists {
		return nil, false
	}

	if time.Now().After(entry.expiry) {
		// Entry expired, but we can't delete while holding read lock
		go func() {
			c.mu.Lock()
			defer c.mu.Unlock()
			delete(c.cache, key)
		}()
		return nil, false
	}

	return entry.decision, true
}

// Set stores a decision in cache
func (c *DecisionCache) Set(key string, decision *PolicyDecision, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Check if we need to evict entries
	if len(c.cache) >= c.maxSize {
		c.evictOldest()
	}

	c.cache[key] = &cacheEntry{
		decision: decision,
		expiry:   time.Now().Add(ttl),
	}
}

// Delete removes a decision from cache
func (c *DecisionCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.cache, key)
}

// Clear removes all entries from cache
func (c *DecisionCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = make(map[string]*cacheEntry)
}

// InvalidatePattern removes entries matching a pattern
func (c *DecisionCache) InvalidatePattern(pattern string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	for key := range c.cache {
		if matchPattern(key, pattern) {
			delete(c.cache, key)
		}
	}
}

// Size returns the current cache size
func (c *DecisionCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.cache)
}

// Stats returns cache statistics
func (c *DecisionCache) Stats() CacheStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	valid := 0
	expired := 0
	now := time.Now()

	for _, entry := range c.cache {
		if now.After(entry.expiry) {
			expired++
		} else {
			valid++
		}
	}

	return CacheStats{
		Total:   len(c.cache),
		Valid:   valid,
		Expired: expired,
		MaxSize: c.maxSize,
	}
}

// evictOldest removes the oldest entry from cache
func (c *DecisionCache) evictOldest() {
	if len(c.cache) == 0 {
		return
	}

	var oldestKey string
	var oldestTime time.Time
	first := true

	for key, entry := range c.cache {
		if first || entry.expiry.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.expiry
			first = false
		}
	}

	if oldestKey != "" {
		delete(c.cache, oldestKey)
	}
}

// cleanup removes expired entries periodically
func (c *DecisionCache) cleanup(interval time.Duration) {
	ticker := time.NewTicker(interval / 4) // Clean up 4 times per TTL period
	defer ticker.Stop()

	for range ticker.C {
		c.mu.Lock()
		now := time.Now()

		for key, entry := range c.cache {
			if now.After(entry.expiry) {
				delete(c.cache, key)
			}
		}

		c.mu.Unlock()
	}
}

// matchPattern checks if a key matches a pattern
func matchPattern(key, pattern string) bool {
	// Simple pattern matching - can be enhanced with regex
	return len(key) >= len(pattern) && key[:len(pattern)] == pattern
}

// CacheStats represents cache statistics
type CacheStats struct {
	Total   int `json:"total"`
	Valid   int `json:"valid"`
	Expired int `json:"expired"`
	MaxSize int `json:"max_size"`
}

// GenerateCacheKey generates a cache key from input data
func GenerateCacheKey(data interface{}) string {
	h := sha256.New()
	h.Write([]byte(fmt.Sprintf("%v", data)))
	return hex.EncodeToString(h.Sum(nil))
}
