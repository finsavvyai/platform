package ai

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

const defaultCacheTTL = 1 * time.Hour

// CacheEntry holds a cached analysis result with expiration.
type CacheEntry struct {
	Result    *analysis.AnalysisResult
	CreatedAt time.Time
	ExpiresAt time.Time
	HitCount  int
}

// ReasoningCache caches security scan results for repeat pipeline configs.
// It uses a SHA-256 hash of the pipeline configuration as the cache key
// to avoid redundant AI calls for identical pipeline setups.
type ReasoningCache struct {
	mu      sync.RWMutex
	entries map[string]*CacheEntry
	ttl     time.Duration
	logger  *logging.Logger
}

// NewReasoningCache creates a new cache with the given TTL.
func NewReasoningCache(ttl time.Duration, logger *logging.Logger) *ReasoningCache {
	if ttl <= 0 {
		ttl = defaultCacheTTL
	}
	return &ReasoningCache{
		entries: make(map[string]*CacheEntry),
		ttl:     ttl,
		logger:  logger,
	}
}

// BuildKey generates a deterministic cache key from pipeline config fields.
func BuildKey(platform, connName, branch string, stepNames []string) string {
	raw := map[string]interface{}{
		"platform":   platform,
		"connection": connName,
		"branch":     branch,
		"steps":      stepNames,
	}
	data, _ := json.Marshal(raw)
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// Get retrieves a cached result if it exists and has not expired.
func (rc *ReasoningCache) Get(key string) (*analysis.AnalysisResult, bool) {
	rc.mu.RLock()
	entry, ok := rc.entries[key]
	rc.mu.RUnlock()

	if !ok {
		return nil, false
	}

	if time.Now().After(entry.ExpiresAt) {
		rc.mu.Lock()
		delete(rc.entries, key)
		rc.mu.Unlock()
		rc.logger.Debugw("Cache entry expired", "key", key[:12])
		return nil, false
	}

	rc.mu.Lock()
	entry.HitCount++
	rc.mu.Unlock()

	rc.logger.Debugw("Cache hit", "key", key[:12], "hits", entry.HitCount)
	return entry.Result, true
}

// Set stores an analysis result in the cache.
func (rc *ReasoningCache) Set(key string, result *analysis.AnalysisResult) {
	now := time.Now()
	rc.mu.Lock()
	rc.entries[key] = &CacheEntry{
		Result:    result,
		CreatedAt: now,
		ExpiresAt: now.Add(rc.ttl),
		HitCount:  0,
	}
	rc.mu.Unlock()

	rc.logger.Debugw("Cached analysis result",
		"key", key[:12],
		"findings", len(result.Findings),
		"ttl", rc.ttl.String(),
	)
}

// Invalidate removes a specific entry from the cache.
func (rc *ReasoningCache) Invalidate(key string) {
	rc.mu.Lock()
	delete(rc.entries, key)
	rc.mu.Unlock()
}

// Purge removes all expired entries from the cache.
func (rc *ReasoningCache) Purge() int {
	now := time.Now()
	purged := 0

	rc.mu.Lock()
	for key, entry := range rc.entries {
		if now.After(entry.ExpiresAt) {
			delete(rc.entries, key)
			purged++
		}
	}
	rc.mu.Unlock()

	if purged > 0 {
		rc.logger.Infow("Purged expired cache entries", "count", purged)
	}
	return purged
}

// Size returns the number of entries currently in the cache.
func (rc *ReasoningCache) Size() int {
	rc.mu.RLock()
	defer rc.mu.RUnlock()
	return len(rc.entries)
}
