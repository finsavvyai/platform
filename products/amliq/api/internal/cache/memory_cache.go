package cache

import (
	"sync"
	"time"
)

// MemoryCache is an in-memory ScreeningCache backed by sync.Map with TTL.
type MemoryCache struct {
	mu    sync.RWMutex
	items map[string]*CacheEntry
}

// NewMemoryCache creates an in-memory screening cache.
func NewMemoryCache() *MemoryCache {
	return &MemoryCache{items: make(map[string]*CacheEntry)}
}

// Get retrieves a cached screening result. Returns nil on miss or expiry.
func (mc *MemoryCache) Get(key ScreeningCacheKey) (*CacheEntry, error) {
	k := CacheKeyString(key)
	mc.mu.RLock()
	entry, ok := mc.items[k]
	mc.mu.RUnlock()
	if !ok {
		return nil, nil
	}
	if entry.IsExpired() {
		mc.mu.Lock()
		delete(mc.items, k)
		mc.mu.Unlock()
		return nil, nil
	}
	return entry, nil
}

// Set stores a screening result with the given TTL.
func (mc *MemoryCache) Set(
	key ScreeningCacheKey, result []byte, ttl time.Duration,
) error {
	if ttl <= 0 {
		ttl = DefaultTTL
	}
	k := CacheKeyString(key)
	mc.mu.Lock()
	mc.items[k] = &CacheEntry{
		Result:   result,
		CachedAt: time.Now().UTC(),
		TTL:      ttl,
	}
	mc.mu.Unlock()
	return nil
}

// Len returns the current number of entries (including expired).
func (mc *MemoryCache) Len() int {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	return len(mc.items)
}
