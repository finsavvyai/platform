package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// NpmRegistryURL is the canonical JSON endpoint that returns the
// latest version metadata for the pushci npm package. We hit npm
// rather than GitHub Releases because the registry is CDN-backed
// (fastly) and every pushci user already trusts npm — if npm is
// down, `npm i -g pushci` is down anyway.
const NpmRegistryURL = "https://registry.npmjs.org/pushci/latest"

// fetchTimeout is the hard wall-clock cap on the HTTP fetch. The
// update check runs in the background but users on flaky wifi
// still deserve to not have ghost goroutines hanging around for
// minutes. 5 seconds is generous; typical fetch is ~200ms.
const fetchTimeout = 5 * time.Second

// latestPayload matches the npm registry's /<package>/latest
// response. We only need the version field — every other field
// (dist.tarball, readme, etc.) is ignored.
type latestPayload struct {
	Version string `json:"version"`
}

// fetchLatest hits the npm registry and returns the latest
// published version string, or an error. Callers should treat any
// error as "skip the update check this cycle" — we never want the
// updater to break a user's CLI session.
//
// The function is deliberately synchronous. The async scheduling
// lives in updater.go so the HTTP layer stays testable with a
// mocked server URL.
func fetchLatest(ctx context.Context, url string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, fetchTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	// npm's registry respects Accept and the compact form is
	// smaller + faster to parse.
	req.Header.Set("Accept", "application/vnd.npm.install-v1+json")
	req.Header.Set("User-Agent", "pushci-cli-updater")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("npm registry returned %d", resp.StatusCode)
	}

	var payload latestPayload
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode: %w", err)
	}
	if payload.Version == "" {
		return "", fmt.Errorf("empty version in response")
	}
	return payload.Version, nil
}
