package clawpipe

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"
)

// CacheStats reports cache performance.
type CacheStats struct {
	Size       int    `json:"size"`
	Hits       int    `json:"hits"`
	Misses     int    `json:"misses"`
	HitRate    string `json:"hitRate"`
	TotalSaved int    `json:"totalSaved"`
}

type cacheEntry struct {
	value     string
	createdAt int64
	hits      int
}

// Cache is a concurrent-safe in-memory prompt cache with TTL and LRU eviction.
type Cache struct {
	mu         sync.RWMutex
	store      map[string]*cacheEntry
	ttlMs      int64
	maxEntries int
	totalHits  int
	totalMiss  int
}

// NewCache creates a Cache. ttlMs=0 defaults to 300 000, max=0 defaults to 10 000.
func NewCache(ttlMs int64, max int) *Cache {
	if ttlMs <= 0 {
		ttlMs = 300_000
	}
	if max <= 0 {
		max = 10_000
	}
	return &Cache{store: make(map[string]*cacheEntry), ttlMs: ttlMs, maxEntries: max}
}

// Key builds a cache key from prompt and options by hashing.
func (c *Cache) Key(prompt string, opts *PromptOptions) string {
	raw, _ := json.Marshal(struct {
		Prompt  string         `json:"prompt"`
		Options *PromptOptions `json:"options"`
	}{prompt, opts})
	return hashDJB2(string(raw))
}

// Get returns (value, true) on cache hit, ("", false) on miss or expired.
func (c *Cache) Get(key string) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.store[key]
	if !ok {
		c.totalMiss++
		return "", false
	}
	if time.Now().UnixMilli()-e.createdAt > c.ttlMs {
		delete(c.store, key)
		c.totalMiss++
		return "", false
	}
	e.hits++
	c.totalHits++
	return e.value, true
}

// Set stores a value, evicting least-hit entries if full.
func (c *Cache) Set(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.evictIfFull()
	c.store[key] = &cacheEntry{value: value, createdAt: time.Now().UnixMilli()}
}

// Has checks existence without counting as hit/miss.
func (c *Cache) Has(key string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.store[key]
	if !ok {
		return false
	}
	return time.Now().UnixMilli()-e.createdAt <= c.ttlMs
}

// Delete removes a key, returning true if it existed.
func (c *Cache) Delete(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.store[key]
	delete(c.store, key)
	return ok
}

// Clear empties the cache and resets counters.
func (c *Cache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.store = make(map[string]*cacheEntry)
	c.totalHits = 0
	c.totalMiss = 0
}

// Stats returns aggregate cache statistics.
func (c *Cache) Stats() CacheStats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	total := c.totalHits + c.totalMiss
	rate := "0.0"
	if total > 0 {
		rate = formatPct(float64(c.totalHits) / float64(total) * 100)
	}
	return CacheStats{
		Size: len(c.store), Hits: c.totalHits, Misses: c.totalMiss,
		HitRate: rate + "%", TotalSaved: c.totalHits,
	}
}

// Prune removes expired entries and returns how many were removed.
func (c *Cache) Prune() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now().UnixMilli()
	n := 0
	for k, e := range c.store {
		if now-e.createdAt > c.ttlMs {
			delete(c.store, k)
			n++
		}
	}
	return n
}

func (c *Cache) evictIfFull() {
	if len(c.store) < c.maxEntries {
		return
	}
	type kv struct {
		key  string
		hits int
	}
	items := make([]kv, 0, len(c.store))
	for k, e := range c.store {
		items = append(items, kv{k, e.hits})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].hits < items[j].hits })
	toRemove := int(math.Ceil(float64(c.maxEntries) * 0.1))
	for i := 0; i < toRemove && i < len(items); i++ {
		delete(c.store, items[i].key)
	}
}

func formatPct(v float64) string {
	s := fmt.Sprintf("%.1f", v)
	return s
}
