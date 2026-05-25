package screening

import (
	"encoding/json"
	"time"

	"github.com/dgraph-io/ristretto"
)

// RistrettoCache is a high-performance concurrent cache backed by ristretto.
// 10M+ ops/sec with admission policy that prevents low-value evictions.
type RistrettoCache struct {
	cache *ristretto.Cache
	ttl   time.Duration
}

// NewRistrettoCache creates a ristretto-backed LRU replacement.
// maxItems: estimated max entries. Uses 10x counters for admission.
func NewRistrettoCache(maxItems int64, ttl time.Duration) (*RistrettoCache, error) {
	if maxItems <= 0 {
		maxItems = 10000
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	cache, err := ristretto.NewCache(&ristretto.Config{
		NumCounters: maxItems * 10, // 10x items for good frequency estimation
		MaxCost:     maxItems,      // each item costs 1
		BufferItems: 64,            // ring buffer per Get/Set batch
	})
	if err != nil {
		return nil, err
	}
	return &RistrettoCache{cache: cache, ttl: ttl}, nil
}

// Get retrieves cached candidates. Thread-safe, lock-free.
func (rc *RistrettoCache) Get(key string) ([]Candidate, bool) {
	val, found := rc.cache.Get(key)
	if !found {
		return nil, false
	}
	data, ok := val.([]byte)
	if !ok {
		return nil, false
	}
	var results []Candidate
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, false
	}
	return results, true
}

// Set stores candidates with TTL. Thread-safe, lock-free.
func (rc *RistrettoCache) Set(key string, results []Candidate) {
	data, err := json.Marshal(results)
	if err != nil {
		return
	}
	rc.cache.SetWithTTL(key, data, 1, rc.ttl)
}

// Len returns approximate entry count.
func (rc *RistrettoCache) Len() uint64 {
	return rc.cache.Metrics.KeysAdded() - rc.cache.Metrics.KeysEvicted()
}

// Wait ensures all buffered Set operations are processed.
func (rc *RistrettoCache) Wait() {
	rc.cache.Wait()
}

// Close cleans up resources.
func (rc *RistrettoCache) Close() {
	rc.cache.Close()
}

// HitRate returns the cache hit ratio.
func (rc *RistrettoCache) HitRate() float64 {
	return rc.cache.Metrics.Ratio()
}
