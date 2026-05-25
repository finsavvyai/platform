package cache

import (
	"sync"
	"time"
)

// TTLCache is a small, thread-safe in-memory key/value cache with per-entry TTL.
// Intended for hot endpoints (lists, marketplace counts) whose payload is
// small and tenant-agnostic. Zero-value is NOT ready; use NewTTLCache.
type TTLCache[V any] struct {
	mu    sync.RWMutex
	items map[string]ttlEntry[V]
	ttl   time.Duration
}

type ttlEntry[V any] struct {
	val V
	exp time.Time
}

// NewTTLCache returns a cache with the given default TTL.
func NewTTLCache[V any](ttl time.Duration) *TTLCache[V] {
	if ttl <= 0 {
		ttl = 2 * time.Hour
	}
	return &TTLCache[V]{items: make(map[string]ttlEntry[V]), ttl: ttl}
}

// Get returns the cached value and true if present and unexpired.
func (c *TTLCache[V]) Get(key string) (V, bool) {
	c.mu.RLock()
	e, ok := c.items[key]
	c.mu.RUnlock()
	var zero V
	if !ok || time.Now().After(e.exp) {
		return zero, false
	}
	return e.val, true
}

// Set stores value with the cache's default TTL.
func (c *TTLCache[V]) Set(key string, val V) {
	c.mu.Lock()
	c.items[key] = ttlEntry[V]{val: val, exp: time.Now().Add(c.ttl)}
	c.mu.Unlock()
}

// Invalidate drops one key. Used after refresh jobs complete.
func (c *TTLCache[V]) Invalidate(key string) {
	c.mu.Lock()
	delete(c.items, key)
	c.mu.Unlock()
}

// Clear drops all keys.
func (c *TTLCache[V]) Clear() {
	c.mu.Lock()
	c.items = make(map[string]ttlEntry[V])
	c.mu.Unlock()
}

// GetOrLoad returns the cached value or invokes loader on miss, caching
// the result. If loader returns an error, nothing is cached.
func (c *TTLCache[V]) GetOrLoad(
	key string, loader func() (V, error),
) (V, error) {
	if v, ok := c.Get(key); ok {
		return v, nil
	}
	v, err := loader()
	if err != nil {
		return v, err
	}
	c.Set(key, v)
	return v, nil
}
