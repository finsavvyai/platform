package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
)

// verifyHTTPClient is the HTTP client used by post-deploy
// verification. Package-level so tests can swap it for an
// httptest.Server-backed client without touching production code.
var verifyHTTPClient = &http.Client{Timeout: 10 * time.Second}

// verifyDeployTarget runs the target's Verify block if present.
// Returns true when verification passes (or no verify is
// configured), false on any failure. Prints one status line per
// attempt so users can see progress in long retry windows.
func verifyDeployTarget(ctx context.Context, t *config.DeployTarget) bool {
	if t.Verify == nil || t.Verify.URL == "" {
		return true
	}
	v := t.Verify
	matcher := buildExpectMatcher(v.Expect)
	interval := v.IntervalDuration()
	retries := v.RetryCount()
	cli.Info(fmt.Sprintf("Verifying %s (up to %d attempts @ %s)", v.URL, retries, interval))
	for attempt := 1; attempt <= retries; attempt++ {
		ok, detail := checkVerifyOnce(ctx, v.URL, matcher)
		if ok {
			cli.Success(fmt.Sprintf("Verify passed on attempt %d/%d (%s)", attempt, retries, detail))
			return true
		}
		if attempt < retries {
			cli.Info(fmt.Sprintf("  attempt %d/%d: %s — retrying in %s", attempt, retries, detail, interval))
			select {
			case <-time.After(interval):
			case <-ctx.Done():
				cli.Error("Verify cancelled")
				return false
			}
		} else {
			cli.Error(fmt.Sprintf("Verify failed after %d attempts: %s", retries, detail))
		}
	}
	return false
}

// checkVerifyOnce is a single GET + match iteration. Returns
// (ok, human-readable-detail) so the caller can log progress.
func checkVerifyOnce(ctx context.Context, url string, match expectMatcher) (bool, string) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false, err.Error()
	}
	resp, err := verifyHTTPClient.Do(req)
	if err != nil {
		return false, err.Error()
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	return match(resp.StatusCode, string(body))
}

// expectMatcher + buildExpectMatcher live in cmd_run_verify_match.go
// so this file stays under the 100-line Go source cap.
