package screening

import (
	"container/list"
	"sync"
	"time"
)

// LRUCache caches recent query results with TTL and eviction.
type LRUCache struct {
	mu      sync.RWMutex
	maxSize int
	ttl     time.Duration
	items   map[string]*list.Element
	order   *list.List
	nowFn   func() time.Time
}

type lruEntry struct {
	key       string
	results   []Candidate
	expiresAt time.Time
}

// NewLRUCache creates a cache with max entries and TTL.
func NewLRUCache(maxSize int, ttl time.Duration) *LRUCache {
	if maxSize <= 0 {
		maxSize = 10000
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &LRUCache{maxSize: maxSize, ttl: ttl,
		items: make(map[string]*list.Element, maxSize),
		order: list.New(), nowFn: time.Now}
}

// Get retrieves cached results. Returns false if missing or expired.
func (c *LRUCache) Get(key string) ([]Candidate, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	elem, ok := c.items[key]
	if !ok {
		return nil, false
	}
	entry := elem.Value.(*lruEntry)
	if c.nowFn().After(entry.expiresAt) {
		c.removeLocked(elem)
		return nil, false
	}
	c.order.MoveToFront(elem)
	return entry.results, true
}

// Set stores results with TTL. Evicts oldest if at capacity.
func (c *LRUCache) Set(key string, results []Candidate) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if elem, ok := c.items[key]; ok {
		c.order.MoveToFront(elem)
		entry := elem.Value.(*lruEntry)
		entry.results = results
		entry.expiresAt = c.nowFn().Add(c.ttl)
		return
	}

	if c.order.Len() >= c.maxSize {
		c.evictLocked()
	}

	entry := &lruEntry{
		key:       key,
		results:   results,
		expiresAt: c.nowFn().Add(c.ttl),
	}
	elem := c.order.PushFront(entry)
	c.items[key] = elem
}

// Len returns the number of cached entries.
func (c *LRUCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.order.Len()
}

func (c *LRUCache) evictLocked() {
	oldest := c.order.Back()
	if oldest != nil {
		c.removeLocked(oldest)
	}
}

func (c *LRUCache) removeLocked(elem *list.Element) {
	entry := elem.Value.(*lruEntry)
	delete(c.items, entry.key)
	c.order.Remove(elem)
}
