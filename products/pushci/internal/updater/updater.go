// Package updater is the non-intrusive CLI update nagger.
//
// Contract:
//  1. NEVER block the user's command. Check runs in a goroutine after main exits.
//  2. NEVER nag more than once per 24 hours. Cached in ~/.pushci/update-check.json.
//  3. NEVER surface network errors. Every failure is swallowed.
//  4. NEVER run in CI, non-TTY, dev builds, or when PUSHCI_NO_UPDATE_CHECK=1.
//
// Banner() returns the cached upgrade message, Refresh() kicks off an async fetch:
//
//	fmt.Fprint(os.Stderr, updater.Banner(version))
//	defer updater.Refresh(version)
package updater

import (
	"context"
	"time"
)

// Banner returns the formatted upgrade notice if the cached latest
// version is strictly newer than `current`, otherwise the empty
// string. Callers print the return value unconditionally — empty
// string means nothing to show. Never hits the network; the HTTP
// fetch happens in Refresh.
func Banner(current string) string {
	if shouldSkip(current) {
		return ""
	}
	entry := loadCache()
	if entry.LatestVersion == "" {
		return ""
	}
	if entry.DismissedFor == entry.LatestVersion {
		return ""
	}
	if !isNewer(entry.LatestVersion, current) {
		return ""
	}
	return formatNotice(current, entry.LatestVersion)
}

// Refresh hits the npm registry if the cache is older than
// CheckInterval, updates the cache, and returns. Fire from a deferred
// goroutine at program exit so the next CLI invocation has fresh
// data. Blocks up to fetchTimeout (5s) then gives up. Safe to call
// even when shouldSkip returns true.
func Refresh(current string) {
	refreshWith(current, NpmRegistryURL)
}

// refreshWith is the testable form of Refresh. Unit tests point url
// at httptest.Server instead of the real npm registry.
func refreshWith(current, url string) {
	if shouldSkip(current) {
		return
	}
	entry := loadCache()
	if !entry.CheckedAt.IsZero() && time.Since(entry.CheckedAt) < CheckInterval {
		return
	}
	latest, err := fetchLatest(context.Background(), url)
	if err != nil {
		return
	}
	entry.LatestVersion = latest
	entry.CheckedAt = time.Now()
	_ = saveCache(entry)
}
