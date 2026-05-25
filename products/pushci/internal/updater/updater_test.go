package updater

import (
	"strings"
	"testing"
	"time"
)

// isolateHome points HOME at a per-test temp dir so cache reads
// and writes never touch the developer's real ~/.pushci/. The
// helper also clears every env var the updater consults so each
// test starts from a deterministic baseline.
func isolateHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	// Clear every opt-out / CI marker so tests hit the "real CLI
	// user on a TTY" baseline. Individual tests re-set any marker
	// they care about.
	for _, k := range []string{
		"PUSHCI_NO_UPDATE_CHECK",
		"NO_COLOR", "FORCE_COLOR",
		"CI", "GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI",
		"BUILDKITE", "JENKINS_URL", "TRAVIS", "DRONE", "PUSHCI_RUNNER",
	} {
		t.Setenv(k, "")
	}
	return home
}

// Cache round-trip + error-path tests live in cache_test.go.

func TestShouldSkip_DevBuild(t *testing.T) {
	isolateHome(t)
	if !shouldSkip("dev") {
		t.Error("dev build should always skip")
	}
	if !shouldSkip("") {
		t.Error("empty version should skip (treated as dev)")
	}
}

func TestShouldSkip_OptOut(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_NO_UPDATE_CHECK", "1")
	if !shouldSkip("1.4.0") {
		t.Error("PUSHCI_NO_UPDATE_CHECK=1 should skip")
	}
}

func TestShouldSkip_CI(t *testing.T) {
	cases := []string{"CI", "GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI", "JENKINS_URL"}
	for _, marker := range cases {
		t.Run(marker, func(t *testing.T) {
			isolateHome(t)
			t.Setenv(marker, "true")
			if !shouldSkip("1.4.0") {
				t.Errorf("should skip when %s is set", marker)
			}
		})
	}
}

func TestBanner_EmptyWhenCacheMissing(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1")
	if got := Banner("1.4.0"); got != "" {
		t.Errorf("expected empty banner on cache miss, got %q", got)
	}
}

func TestBanner_EmptyWhenCachedIsSameOrOlder(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1")
	saveCache(cacheEntry{LatestVersion: "1.4.0", CheckedAt: time.Now()})
	if got := Banner("1.4.0"); got != "" {
		t.Errorf("banner should be empty when cached == current, got %q", got)
	}

	saveCache(cacheEntry{LatestVersion: "1.3.9", CheckedAt: time.Now()})
	if got := Banner("1.4.0"); got != "" {
		t.Errorf("banner should be empty when cached < current, got %q", got)
	}
}

func TestBanner_RendersWhenCachedIsNewer(t *testing.T) {
	isolateHome(t)
	t.Setenv("NO_COLOR", "1")                  // predictable text output
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1") // non-TTY in go test
	saveCache(cacheEntry{LatestVersion: "1.4.1", CheckedAt: time.Now()})

	got := Banner("1.4.0")
	if got == "" {
		t.Fatal("expected banner when cached newer than current")
	}
	for _, want := range []string{"update available", "1.4.0", "1.4.1", "npm i -g pushci@latest", "brew upgrade pushci"} {
		if !strings.Contains(got, want) {
			t.Errorf("banner missing %q\n--- banner ---\n%s", want, got)
		}
	}
}

func TestRefresh_PublicWrapperRoutesToRefreshWith(t *testing.T) {
	// Refresh() is a thin wrapper that hard-codes the npm URL. We
	// can't redirect it, but calling it with the opt-out env set
	// at least exercises the wrapper + skip branch for coverage.
	isolateHome(t)
	t.Setenv("PUSHCI_NO_UPDATE_CHECK", "1")
	Refresh("1.4.0")
	if entry := loadCache(); entry.LatestVersion != "" {
		t.Errorf("opted-out Refresh should not touch cache, got %+v", entry)
	}
}

func TestShouldSkip_ForceOverridesEverythingExceptOptOut(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1")
	t.Setenv("CI", "true") // would normally skip

	if shouldSkip("1.4.0") {
		t.Error("force env should override CI skip")
	}

	// Explicit opt-out still wins
	t.Setenv("PUSHCI_NO_UPDATE_CHECK", "1")
	if !shouldSkip("1.4.0") {
		t.Error("opt-out should still win over force env")
	}
}

func TestShouldSkip_ForceOverridesDevBuild(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1")
	if shouldSkip("dev") {
		t.Error("force env should override dev-build skip — useful for debugging")
	}
}

func TestIsCI_FalseWhenNoMarkersSet(t *testing.T) {
	isolateHome(t)
	if isCI() {
		t.Error("isCI should be false with no CI env markers")
	}
}

func TestIsTerminal_TestHook(t *testing.T) {
	original := terminalFn
	t.Cleanup(func() { terminalFn = original })

	terminalFn = func() bool { return true }
	if !isTerminal() {
		t.Error("terminalFn=true should make isTerminal return true")
	}
	terminalFn = func() bool { return false }
	if isTerminal() {
		t.Error("terminalFn=false should make isTerminal return false")
	}
	// Also exercise the real implementation once so
	// defaultIsTerminal isn't reported as dead code.
	_ = defaultIsTerminal()
}

func TestBanner_DismissedForOlderVersionDoesNotSuppress(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1")
	t.Setenv("NO_COLOR", "1")
	// User dismissed an older version; a newer release should
	// still show the banner.
	saveCache(cacheEntry{
		LatestVersion: "1.5.0",
		DismissedFor:  "1.4.0",
		CheckedAt:     time.Now(),
	})
	if got := Banner("1.4.0"); got == "" {
		t.Error("dismissal of older version should not suppress banner for newer")
	}
}

func TestBanner_DismissedSuppressesNotice(t *testing.T) {
	isolateHome(t)
	t.Setenv("PUSHCI_FORCE_UPDATE_CHECK", "1")
	saveCache(cacheEntry{
		LatestVersion: "1.4.1",
		DismissedFor:  "1.4.1",
		CheckedAt:     time.Now(),
	})
	if got := Banner("1.4.0"); got != "" {
		t.Errorf("dismissed version should suppress banner, got %q", got)
	}
}

// fetchLatest + HTTP edge-case tests live in refresh_test.go where
// they share the fakeRegistry httptest helper with the Refresh
// exercises.
