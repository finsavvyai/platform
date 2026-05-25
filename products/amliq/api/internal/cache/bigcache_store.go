package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/allegro/bigcache/v3"
)

// BigCacheStore provides zero-GC caching for screening results.
// Stores data as []byte in mmap-like shards, avoiding GC scanning
// of millions of cached screening results under high load.
type BigCacheStore struct {
	cache *bigcache.BigCache
}

// BigCacheConfig holds configuration for the zero-GC cache.
type BigCacheConfig struct {
	LifeWindow time.Duration // TTL for entries (default 24h)
	MaxEntryMB int           // Max size per entry in MB (default 1)
	MaxSizeMB  int           // Hard memory cap in MB (default 512)
	Shards     int           // Number of shards, must be power of 2 (default 1024)
}

// NewBigCacheStore creates a zero-GC cache for screening results.
func NewBigCacheStore(cfg BigCacheConfig) (*BigCacheStore, error) {
	if cfg.LifeWindow <= 0 {
		cfg.LifeWindow = 24 * time.Hour
	}
	if cfg.MaxEntryMB <= 0 {
		cfg.MaxEntryMB = 1
	}
	if cfg.MaxSizeMB <= 0 {
		cfg.MaxSizeMB = 512
	}
	if cfg.Shards <= 0 {
		cfg.Shards = 1024
	}

	config := bigcache.Config{
		Shards:             cfg.Shards,
		LifeWindow:         cfg.LifeWindow,
		CleanWindow:        5 * time.Minute,
		MaxEntriesInWindow: 1000 * 10 * 60, // 10K entries/sec * 60s
		MaxEntrySize:       cfg.MaxEntryMB * 1024 * 1024,
		HardMaxCacheSize:   cfg.MaxSizeMB,
		Verbose:            false,
	}

	cache, err := bigcache.New(context.Background(), config)
	if err != nil {
		return nil, err
	}
	return &BigCacheStore{cache: cache}, nil
}

// Get retrieves a cached screening result. Returns nil if not found.
func (bc *BigCacheStore) Get(key string) ([]byte, error) {
	return bc.cache.Get(key)
}

// Set stores a screening result as raw bytes.
func (bc *BigCacheStore) Set(key string, value []byte) error {
	return bc.cache.Set(key, value)
}

// GetJSON retrieves and unmarshals a cached value.
func (bc *BigCacheStore) GetJSON(key string, dest interface{}) error {
	data, err := bc.cache.Get(key)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

// SetJSON marshals and stores a value.
func (bc *BigCacheStore) SetJSON(key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return bc.cache.Set(key, data)
}

// Len returns the number of cached entries.
func (bc *BigCacheStore) Len() int {
	return bc.cache.Len()
}

// Stats returns cache statistics.
func (bc *BigCacheStore) Stats() bigcache.Stats {
	return bc.cache.Stats()
}

// Close cleans up the cache.
func (bc *BigCacheStore) Close() error {
	return bc.cache.Close()
}
