package mocks

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/queryflux/backend/internal/application/ports"
)

// MockCacheManager implements CacheManager
type MockCacheManager struct {
	cache map[string]cacheEntry
	mu    sync.RWMutex
}

type cacheEntry struct {
	value     interface{}
	expiresAt time.Time
}

func NewMockCacheManager() *MockCacheManager {
	return &MockCacheManager{
		cache: make(map[string]cacheEntry),
	}
}

func (m *MockCacheManager) Get(ctx context.Context, key string) (interface{}, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	entry, ok := m.cache[key]
	if !ok {
		return nil, ports.ErrNotFound
	}

	if time.Now().After(entry.expiresAt) {
		delete(m.cache, key)
		return nil, ports.ErrNotFound
	}

	return entry.value, nil
}

func (m *MockCacheManager) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.cache[key] = cacheEntry{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}

	return nil
}

func (m *MockCacheManager) Delete(ctx context.Context, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.cache, key)
	return nil
}

func (m *MockCacheManager) Clear(ctx context.Context, pattern string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if pattern == "*" {
		m.cache = make(map[string]cacheEntry)
	} else {
		for key := range m.cache {
			if strings.Contains(key, pattern) {
				delete(m.cache, key)
			}
		}
	}

	return nil
}

func (m *MockCacheManager) GetStats(ctx context.Context) (map[string]interface{}, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := map[string]interface{}{
		"total_keys":   len(m.cache),
		"memory_usage": 1024,
	}

	return stats, nil
}
