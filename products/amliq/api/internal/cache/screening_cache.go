package cache

import "time"

// ScreeningCacheKey identifies a cached screening result.
type ScreeningCacheKey struct {
	EntityName string
	EntityDOB  string
	ListSource string
}

// CacheEntry holds a cached screening result with TTL metadata.
type CacheEntry struct {
	Result   []byte
	CachedAt time.Time
	TTL      time.Duration
}

// IsExpired returns true if the entry has exceeded its TTL.
func (ce *CacheEntry) IsExpired() bool {
	return time.Since(ce.CachedAt) > ce.TTL
}

// ScreeningCache caches screening results for repeat entities.
// Same entity screened daily shouldn't re-run the full cascade.
type ScreeningCache interface {
	Get(key ScreeningCacheKey) (*CacheEntry, error)
	Set(key ScreeningCacheKey, result []byte, ttl time.Duration) error
}

// CacheKeyString returns a deterministic string key for cache lookups.
func CacheKeyString(k ScreeningCacheKey) string {
	return "screen:" + k.EntityName + ":" + k.EntityDOB + ":" + k.ListSource
}
