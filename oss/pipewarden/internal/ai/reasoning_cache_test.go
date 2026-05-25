package ai

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// cacheLogger returns a default logger for test use.
func cacheLogger() *logging.Logger { return logging.NewDefault() }

// sampleResult returns a minimal AnalysisResult for cache tests.
func sampleResult(runID string) *analysis.AnalysisResult {
	return &analysis.AnalysisResult{
		ConnectionName: "test-conn",
		RunID:          runID,
		RiskScore:      42,
	}
}

// ---- NewReasoningCache ----

func TestNewReasoningCache_ReturnsNonNil(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	if rc == nil {
		t.Fatal("NewReasoningCache returned nil")
	}
}

func TestNewReasoningCache_ZeroTTLUsesDefault(t *testing.T) {
	rc := NewReasoningCache(0, cacheLogger())
	if rc.ttl != defaultCacheTTL {
		t.Errorf("expected default TTL %v, got %v", defaultCacheTTL, rc.ttl)
	}
}

func TestNewReasoningCache_NegativeTTLUsesDefault(t *testing.T) {
	rc := NewReasoningCache(-5*time.Second, cacheLogger())
	if rc.ttl != defaultCacheTTL {
		t.Errorf("expected default TTL for negative input, got %v", rc.ttl)
	}
}

func TestNewReasoningCache_CustomTTLPreserved(t *testing.T) {
	ttl := 10 * time.Minute
	rc := NewReasoningCache(ttl, cacheLogger())
	if rc.ttl != ttl {
		t.Errorf("expected TTL %v, got %v", ttl, rc.ttl)
	}
}

// ---- BuildKey ----

func TestBuildKey_DeterministicOutput(t *testing.T) {
	k1 := BuildKey("github", "my-conn", "main", []string{"build", "test"})
	k2 := BuildKey("github", "my-conn", "main", []string{"build", "test"})
	if k1 != k2 {
		t.Error("BuildKey is not deterministic")
	}
}

func TestBuildKey_DifferentInputsDifferentKeys(t *testing.T) {
	k1 := BuildKey("github", "conn-a", "main", []string{"build"})
	k2 := BuildKey("github", "conn-b", "main", []string{"build"})
	if k1 == k2 {
		t.Error("expected different keys for different connection names")
	}
}

func TestBuildKey_DifferentPlatformsDifferentKeys(t *testing.T) {
	k1 := BuildKey("github", "c", "main", []string{"a"})
	k2 := BuildKey("gitlab", "c", "main", []string{"a"})
	if k1 == k2 {
		t.Error("expected different keys for different platforms")
	}
}

func TestBuildKey_DifferentBranchesDifferentKeys(t *testing.T) {
	k1 := BuildKey("github", "c", "main", []string{"a"})
	k2 := BuildKey("github", "c", "develop", []string{"a"})
	if k1 == k2 {
		t.Error("expected different keys for different branches")
	}
}

func TestBuildKey_DifferentStepsDifferentKeys(t *testing.T) {
	k1 := BuildKey("github", "c", "main", []string{"build"})
	k2 := BuildKey("github", "c", "main", []string{"build", "test"})
	if k1 == k2 {
		t.Error("expected different keys for different step lists")
	}
}

func TestBuildKey_ReturnsHexString(t *testing.T) {
	k := BuildKey("github", "c", "main", nil)
	if len(k) != 64 {
		t.Errorf("expected 64-char hex (SHA-256), got length %d", len(k))
	}
}

// ---- Get / Set ----

func TestGetSet_RoundTrip(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	key := BuildKey("github", "c", "main", []string{"build"})
	result := sampleResult("run-1")

	rc.Set(key, result)
	got, ok := rc.Get(key)
	if !ok {
		t.Fatal("expected cache hit")
	}
	if got.RunID != result.RunID {
		t.Errorf("expected RunID %s, got %s", result.RunID, got.RunID)
	}
}

func TestGet_MissReturnsFalse(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	_, ok := rc.Get("nonexistent-key-abcdefghij")
	if ok {
		t.Error("expected cache miss for unknown key")
	}
}

func TestGet_ExpiredEntryReturnsMiss(t *testing.T) {
	// Use a very short TTL so the entry expires immediately.
	rc := NewReasoningCache(1*time.Millisecond, cacheLogger())
	key := BuildKey("github", "c", "main", []string{"build"})
	rc.Set(key, sampleResult("run-expired"))

	// Wait for expiry.
	time.Sleep(10 * time.Millisecond)

	_, ok := rc.Get(key)
	if ok {
		t.Error("expected cache miss for expired entry")
	}
}

func TestGet_ExpiredEntryDeletedFromCache(t *testing.T) {
	rc := NewReasoningCache(1*time.Millisecond, cacheLogger())
	key := BuildKey("github", "c", "main", []string{"build"})
	rc.Set(key, sampleResult("run-x"))

	time.Sleep(10 * time.Millisecond)
	rc.Get(key) // triggers delete of expired entry

	if rc.Size() != 0 {
		t.Errorf("expected cache size 0 after expired entry deleted, got %d", rc.Size())
	}
}

func TestGet_HitCountIncrementsOnRepeatedAccess(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	key := BuildKey("github", "c", "main", []string{"step"})
	rc.Set(key, sampleResult("run-hits"))

	for i := 0; i < 3; i++ {
		_, _ = rc.Get(key)
	}

	rc.mu.RLock()
	entry := rc.entries[key]
	rc.mu.RUnlock()

	if entry.HitCount != 3 {
		t.Errorf("expected HitCount=3, got %d", entry.HitCount)
	}
}

// ---- Invalidate ----

func TestInvalidate_RemovesEntry(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	key := BuildKey("github", "c", "main", []string{"step"})
	rc.Set(key, sampleResult("run-inv"))

	rc.Invalidate(key)

	if rc.Size() != 0 {
		t.Errorf("expected size 0 after invalidation, got %d", rc.Size())
	}
	_, ok := rc.Get(key)
	if ok {
		t.Error("expected cache miss after invalidation")
	}
}

func TestInvalidate_NonExistentKeyIsNoOp(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	// Should not panic or error.
	rc.Invalidate("this-key-does-not-exist-abcde")
}

// ---- Purge ----

func TestPurge_RemovesOnlyExpiredEntries(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())

	// Add a valid (long TTL) entry using the full TTL cache.
	activeKey := BuildKey("github", "active", "main", []string{"a"})
	rc.Set(activeKey, sampleResult("active"))

	// Manually insert an already-expired entry to bypass TTL.
	expiredKey := BuildKey("github", "expired", "main", []string{"b"})
	rc.mu.Lock()
	rc.entries[expiredKey] = &CacheEntry{
		Result:    sampleResult("expired"),
		CreatedAt: time.Now().Add(-2 * time.Hour),
		ExpiresAt: time.Now().Add(-1 * time.Hour),
	}
	rc.mu.Unlock()

	purged := rc.Purge()
	if purged != 1 {
		t.Errorf("expected 1 purged entry, got %d", purged)
	}
	if rc.Size() != 1 {
		t.Errorf("expected 1 remaining entry, got %d", rc.Size())
	}
}

func TestPurge_NothingExpiredReturnZero(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	key := BuildKey("github", "c", "main", []string{"step"})
	rc.Set(key, sampleResult("run-1"))

	purged := rc.Purge()
	if purged != 0 {
		t.Errorf("expected 0 purged, got %d", purged)
	}
}

func TestPurge_EmptyCacheReturnsZero(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	purged := rc.Purge()
	if purged != 0 {
		t.Errorf("expected 0 purged for empty cache, got %d", purged)
	}
}

// ---- Size ----

func TestSize_EmptyIsZero(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	if rc.Size() != 0 {
		t.Errorf("expected size 0, got %d", rc.Size())
	}
}

func TestSize_IncreasesOnSet(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	for i := 0; i < 5; i++ {
		key := BuildKey("github", fmt.Sprintf("conn-%d", i), "main", nil)
		rc.Set(key, sampleResult(fmt.Sprintf("run-%d", i)))
	}
	if rc.Size() != 5 {
		t.Errorf("expected size 5, got %d", rc.Size())
	}
}

func TestSize_DecreaseOnInvalidate(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	key := BuildKey("github", "c", "main", nil)
	rc.Set(key, sampleResult("r"))
	rc.Invalidate(key)
	if rc.Size() != 0 {
		t.Errorf("expected size 0 after invalidate, got %d", rc.Size())
	}
}

// ---- Concurrent access ----

func TestCache_ConcurrentReadWrite(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	const goroutines = 20
	var wg sync.WaitGroup

	// Writers
	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func(i int) {
			defer wg.Done()
			key := BuildKey("github", fmt.Sprintf("c-%d", i), "main", nil)
			rc.Set(key, sampleResult(fmt.Sprintf("run-%d", i)))
		}(i)
	}

	// Readers (concurrent with writers)
	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func(i int) {
			defer wg.Done()
			key := BuildKey("github", fmt.Sprintf("c-%d", i), "main", nil)
			_, _ = rc.Get(key)
		}(i)
	}

	wg.Wait()
	// No data race — test passes if no panic or race detector report.
}

func TestCache_ConcurrentInvalidateAndGet(t *testing.T) {
	rc := NewReasoningCache(time.Minute, cacheLogger())
	key := BuildKey("github", "shared", "main", []string{"step"})
	rc.Set(key, sampleResult("r1"))

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			rc.Invalidate(key)
			rc.Set(key, sampleResult("r2"))
		}
	}()
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			_, _ = rc.Get(key)
		}
	}()

	wg.Wait()
}
