package ai

import (
	"sync"
	"time"
)

// ReasoningCache provides in-memory caching for repeat AI analysis.
type ReasoningCache struct {
	cache sync.Map
}

type cacheEntry struct {
	value   string
	expires time.Time
}

// NewReasoningCache creates a new empty cache.
func NewReasoningCache() *ReasoningCache {
	return &ReasoningCache{}
}

// Get retrieves a cached value. Returns empty string and false if
// the key is missing or expired.
func (c *ReasoningCache) Get(key string) (string, bool) {
	raw, ok := c.cache.Load(key)
	if !ok {
		return "", false
	}
	entry := raw.(cacheEntry)
	if time.Now().After(entry.expires) {
		c.cache.Delete(key)
		return "", false
	}
	return entry.value, true
}

// Set stores a value with a time-to-live duration.
func (c *ReasoningCache) Set(key string, value string, ttl time.Duration) {
	c.cache.Store(key, cacheEntry{
		value:   value,
		expires: time.Now().Add(ttl),
	})
}

// Delete removes a key from the cache.
func (c *ReasoningCache) Delete(key string) {
	c.cache.Delete(key)
}

// Clear removes all entries from the cache.
func (c *ReasoningCache) Clear() {
	c.cache.Range(func(key, _ any) bool {
		c.cache.Delete(key)
		return true
	})
}
