package updater

import (
	"os"
	"testing"
	"time"
)

// Cache-layer tests. Split from updater_test.go so each file
// stays focused and under the 200-line cap.

func TestCacheRoundTrip(t *testing.T) {
	isolateHome(t)

	// Loading from a missing cache yields the zero value — never
	// an error. This is load-bearing for the updater contract.
	first := loadCache()
	if first.LatestVersion != "" || !first.CheckedAt.IsZero() {
		t.Errorf("expected zero-value cache on fresh HOME, got %+v", first)
	}

	entry := cacheEntry{
		LatestVersion: "1.4.1",
		CheckedAt:     time.Now().Truncate(time.Second),
	}
	if err := saveCache(entry); err != nil {
		t.Fatalf("saveCache: %v", err)
	}

	got := loadCache()
	if got.LatestVersion != entry.LatestVersion {
		t.Errorf("LatestVersion = %q, want %q", got.LatestVersion, entry.LatestVersion)
	}
	if !got.CheckedAt.Equal(entry.CheckedAt) {
		t.Errorf("CheckedAt = %v, want %v", got.CheckedAt, entry.CheckedAt)
	}
}

func TestLoadCache_CorruptedJsonYieldsZeroValue(t *testing.T) {
	isolateHome(t)
	path, _ := cachePath()
	if err := os.MkdirAll(path[:len(path)-len("update-check.json")], 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("{not valid json"), 0o600); err != nil {
		t.Fatal(err)
	}
	got := loadCache()
	if got.LatestVersion != "" {
		t.Errorf("corrupted cache should yield zero value, got %+v", got)
	}
}

func TestSaveCache_ReadOnlyHomeReturnsError(t *testing.T) {
	if os.Getuid() == 0 {
		t.Skip("root bypasses 0500 permission")
	}
	home := isolateHome(t)
	if err := os.Chmod(home, 0o500); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(home, 0o700) })

	err := saveCache(cacheEntry{LatestVersion: "1.4.1", CheckedAt: time.Now()})
	if err == nil {
		t.Error("expected saveCache to fail against read-only home")
	}
}

func TestCachePath_RespectsHome(t *testing.T) {
	home := isolateHome(t)
	p, err := cachePath()
	if err != nil {
		t.Fatal(err)
	}
	if len(p) < len(home) || p[:len(home)] != home {
		t.Errorf("cachePath %q should be under HOME %q", p, home)
	}
}
