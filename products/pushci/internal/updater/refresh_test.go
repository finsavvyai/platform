package updater

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestFetchLatest_Success(t *testing.T) {
	srv := fakeRegistry(t, `{"version":"1.4.1"}`, http.StatusOK)
	defer srv.Close()

	got, err := fetchLatest(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("fetchLatest: %v", err)
	}
	if got != "1.4.1" {
		t.Errorf("got %q, want 1.4.1", got)
	}
}

func TestFetchLatest_Non200(t *testing.T) {
	srv := fakeRegistry(t, `{"error":"not found"}`, http.StatusNotFound)
	defer srv.Close()

	if _, err := fetchLatest(context.Background(), srv.URL); err == nil {
		t.Error("expected error on 404 response")
	}
}

func TestFetchLatest_EmptyVersion(t *testing.T) {
	srv := fakeRegistry(t, `{"version":""}`, http.StatusOK)
	defer srv.Close()

	if _, err := fetchLatest(context.Background(), srv.URL); err == nil {
		t.Error("expected error on empty version field")
	}
}

func TestFetchLatest_InvalidURL(t *testing.T) {
	// A URL with a control byte in the host makes
	// http.NewRequestWithContext fail during parsing. Exercises
	// the error path we otherwise couldn't reach.
	if _, err := fetchLatest(context.Background(), "http://\x00invalid"); err == nil {
		t.Error("expected error on invalid URL")
	}
}

func TestFetchLatest_MalformedJson(t *testing.T) {
	srv := fakeRegistry(t, `{not json`, http.StatusOK)
	defer srv.Close()
	if _, err := fetchLatest(context.Background(), srv.URL); err == nil {
		t.Error("expected decode error on malformed JSON")
	}
}

func TestFetchLatest_UnreachableServer(t *testing.T) {
	srv := fakeRegistry(t, `{"version":"1.4.1"}`, http.StatusOK)
	srv.Close() // close before we call so the connection fails
	if _, err := fetchLatest(context.Background(), srv.URL); err == nil {
		t.Error("expected connection error against closed server")
	}
}

// fakeRegistry spins up an httptest server that mimics the npm
// registry `/<package>/latest` endpoint. Tests use this to
// exercise refreshWith without touching the real registry.
func fakeRegistry(t *testing.T, payload string, status int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(payload))
	}))
}

func TestRefresh_WritesLatestVersionToCache(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1")
	srv := fakeRegistry(t, `{"version":"1.4.1"}`, http.StatusOK)
	defer srv.Close()

	refreshWith("1.4.0", srv.URL)

	entry := loadCache()
	if entry.LatestVersion != "1.4.1" {
		t.Errorf("LatestVersion = %q, want 1.4.1", entry.LatestVersion)
	}
	if entry.CheckedAt.IsZero() {
		t.Error("CheckedAt should be populated after successful refresh")
	}
}

func TestRefresh_SkipsWhenCacheIsFresh(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1")

	// Pre-seed a fresh cache — anything inside the CheckInterval
	// window should be honored and we should NOT hit the server.
	original := cacheEntry{
		LatestVersion: "9.9.9-cached",
		CheckedAt:     time.Now().Add(-1 * time.Hour),
	}
	if err := saveCache(original); err != nil {
		t.Fatal(err)
	}

	// Point at a server that would blow up if called, so the
	// test fails loudly if the skip check regresses.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("refreshWith hit the server despite a fresh cache")
		w.WriteHeader(500)
	}))
	defer srv.Close()

	refreshWith("1.4.0", srv.URL)

	entry := loadCache()
	if entry.LatestVersion != "9.9.9-cached" {
		t.Errorf("cache should be untouched; got LatestVersion=%q", entry.LatestVersion)
	}
}

func TestRefresh_RefetchesWhenCacheIsStale(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1")

	stale := cacheEntry{
		LatestVersion: "1.3.0",
		CheckedAt:     time.Now().Add(-48 * time.Hour),
	}
	if err := saveCache(stale); err != nil {
		t.Fatal(err)
	}

	srv := fakeRegistry(t, `{"version":"1.4.1"}`, http.StatusOK)
	defer srv.Close()

	refreshWith("1.4.0", srv.URL)

	entry := loadCache()
	if entry.LatestVersion != "1.4.1" {
		t.Errorf("LatestVersion = %q, want 1.4.1 after stale refresh", entry.LatestVersion)
	}
}

func TestRefresh_SwallowsServerError(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1")

	srv := fakeRegistry(t, `{"error":"boom"}`, http.StatusInternalServerError)
	defer srv.Close()

	// Must not panic and must not write anything bogus to the cache.
	refreshWith("1.4.0", srv.URL)

	entry := loadCache()
	if entry.LatestVersion != "" {
		t.Errorf("failed refresh should leave cache empty, got %q", entry.LatestVersion)
	}
	if !entry.CheckedAt.IsZero() {
		t.Error("failed refresh should not bump CheckedAt")
	}
}

func TestRefresh_RespectsSkipChecks(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_NO_UPDATE_CHECK", "1")

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		t.Error("refreshWith should not hit the server when opt-out is set")
		w.WriteHeader(500)
	}))
	defer srv.Close()

	refreshWith("1.4.0", srv.URL)

	entry := loadCache()
	if entry.LatestVersion != "" {
		t.Errorf("skipped refresh should leave cache empty, got %q", entry.LatestVersion)
	}
}
