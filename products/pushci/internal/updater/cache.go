package updater

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"
)

// cacheFileName is the relative path under the user's config dir
// where we persist the last successful update check. The file is
// small (~100 bytes) and written atomically via rename.
const cacheFileName = ".pushci/update-check.json"

// CheckInterval is how often we re-hit the npm registry. Once a
// day is the sweet spot: users see new releases within 24h, and
// we don't hammer npm on every single CLI invocation.
const CheckInterval = 24 * time.Hour

// cacheEntry is the exact JSON shape written to disk. All fields
// are documented so future maintainers can extend the schema
// without breaking existing reads (json.Decode silently ignores
// unknown fields, and every field here is optional on read).
type cacheEntry struct {
	// LatestVersion is the most recently observed latest version
	// from the npm registry. Empty when we've never successfully
	// fetched, in which case the banner is suppressed.
	LatestVersion string `json:"latest_version,omitempty"`

	// CheckedAt is when we last successfully fetched. We only
	// re-fetch when now - CheckedAt > CheckInterval.
	CheckedAt time.Time `json:"checked_at,omitempty"`

	// DismissedFor records the last version the user saw the
	// banner for. Prevents re-nagging after they've acknowledged.
	// Updated by updater.DismissBanner() — not implemented yet,
	// reserved for future "don't show me again" UX.
	DismissedFor string `json:"dismissed_for,omitempty"`
}

// cachePath resolves the absolute path to the cache file. Uses
// $HOME (the standard Unix convention) so test code can override
// via HOME= and sandbox to a temp dir.
func cachePath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, cacheFileName), nil
}

// loadCache reads the cache file and returns a zero-value entry
// when the file is missing or unreadable. Corrupted JSON is
// silently discarded — next successful fetch overwrites it.
//
// Errors are never returned: a broken cache must never break the
// CLI. Worst case, we treat it as "no cache" and re-fetch.
func loadCache() cacheEntry {
	path, err := cachePath()
	if err != nil {
		return cacheEntry{}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return cacheEntry{}
	}
	var entry cacheEntry
	if err := json.Unmarshal(data, &entry); err != nil {
		return cacheEntry{}
	}
	return entry
}

// saveCache writes the entry atomically via temp-file + rename so
// a crash mid-write can't corrupt the cache.  The 0600 permission
// mask is cargo-culted from ~/.npmrc / ~/.ssh conventions — it's
// not sensitive data but there's no reason to make it world-
// readable either.
func saveCache(entry cacheEntry) error {
	path, err := cachePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(entry, "", "  ")
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
