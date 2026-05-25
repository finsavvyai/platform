package cache

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

// CacheEntry is one cached completion with its TTL deadline.
type CacheEntry struct {
	Response  string
	ExpiresAt time.Time
}

// PromptCache stores SHA256(prompt) → response with TTL. Sized cap
// is a soft limit — entries are pruned lazily on Get and Set.
//
// Why content-addressed by full prompt rather than embedding:
// AML alert summarization sends the SAME prompt template with the
// SAME entity data on a reload — that's a true repeat, not a
// semantic similarity. Real semantic cache (vectors + cosine) would
// risk returning a summary for a different alert that just happens
// to be embedding-close. For compliance use, exact-match is the
// safe default.
type PromptCache struct {
	mu      sync.Mutex
	entries map[string]CacheEntry
	ttl     time.Duration
	maxSize int
}

// NewPromptCache constructs an empty cache. ttl <= 0 disables (a
// nil cache is a valid no-op for the wrapper). maxSize bounds total
// entries (soft cap, oldest-by-creation evicted first).
func NewPromptCache(ttl time.Duration, maxSize int) *PromptCache {
	if ttl <= 0 {
		return nil
	}
	if maxSize <= 0 {
		maxSize = 1000
	}
	return &PromptCache{
		entries: make(map[string]CacheEntry),
		ttl:     ttl,
		maxSize: maxSize,
	}
}

// Key derives the cache key from a tenantID + prompt. Tenant scoping
// prevents one tenant's cached response from leaking into another
// (paranoid: even though the same prompt would produce the same
// response, isolating by tenant is the conservative compliance call).
func (c *PromptCache) Key(tenantID, prompt string) string {
	h := sha256.Sum256([]byte(tenantID + "|" + prompt))
	return hex.EncodeToString(h[:])
}

// Get returns (response, true) on a live hit, ("", false) otherwise.
// Lazily evicts the entry on TTL miss.
func (c *PromptCache) Get(key string) (string, bool) {
	if c == nil {
		return "", false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[key]
	if !ok {
		return "", false
	}
	if time.Now().After(e.ExpiresAt) {
		delete(c.entries, key)
		return "", false
	}
	return e.Response, true
}

// Set stores a response. When the cache exceeds maxSize, prunes
// expired entries first; if still over, drops a small batch (no
// strict LRU — accepting some unfairness to keep the lock fast).
func (c *PromptCache) Set(key, response string) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.entries) >= c.maxSize {
		c.evictLocked()
	}
	c.entries[key] = CacheEntry{
		Response:  response,
		ExpiresAt: time.Now().Add(c.ttl),
	}
}

// evictLocked + CacheLookup live in cache_evict.go.
