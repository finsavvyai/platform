package cache

import (
	"crypto/sha256"
	"fmt"
)

// CacheStore is the backend for the global cache (e.g. R2, disk).
type CacheStore interface {
	Get(key string) ([]byte, bool)
	Put(key string, data []byte) error
	Delete(key string) error
}

// GlobalCache provides a content-addressable cache for CI artifacts.
type GlobalCache struct {
	store CacheStore
}

// NewGlobalCache creates a global cache backed by the given store.
func NewGlobalCache(store CacheStore) *GlobalCache {
	return &GlobalCache{store: store}
}

// Key generates a SHA-256 cache key from project name and deps content.
func (gc *GlobalCache) Key(project, deps string) string {
	h := sha256.New()
	h.Write([]byte(project))
	h.Write([]byte(":"))
	h.Write([]byte(deps))
	return fmt.Sprintf("%x", h.Sum(nil))
}

// Get retrieves data from the cache. Returns nil, false on miss.
func (gc *GlobalCache) Get(key string) ([]byte, bool) {
	return gc.store.Get(key)
}

// Put stores data in the cache.
func (gc *GlobalCache) Put(key string, data []byte) error {
	return gc.store.Put(key, data)
}

// Invalidate removes an entry from the cache.
func (gc *GlobalCache) Invalidate(key string) {
	_ = gc.store.Delete(key)
}

// MemoryStore is an in-memory CacheStore for testing.
type MemoryStore struct {
	data map[string][]byte
}

// NewMemoryStore creates an in-memory cache store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{data: make(map[string][]byte)}
}

// Get retrieves a value.
func (m *MemoryStore) Get(key string) ([]byte, bool) {
	v, ok := m.data[key]
	return v, ok
}

// Put stores a value.
func (m *MemoryStore) Put(key string, data []byte) error {
	m.data[key] = data
	return nil
}

// Delete removes a value.
func (m *MemoryStore) Delete(key string) error {
	delete(m.data, key)
	return nil
}
