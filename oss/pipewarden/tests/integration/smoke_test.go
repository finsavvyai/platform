// Package integration runs smoke tests against a deployed PipeWarden URL.
// Skipped unless -smoke-url is passed. Intended for post-deploy verification
// from scripts/deploy.sh.
package integration

import (
	"flag"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"
)

var smokeURL = flag.String("smoke-url", "", "Base URL of deployed PipeWarden (e.g. https://pipewarden.workers.dev)")

func client() *http.Client { return &http.Client{Timeout: 15 * time.Second} }

func get(t *testing.T, path string) (int, string) {
	t.Helper()
	if *smokeURL == "" {
		t.Skip("set -smoke-url to run smoke tests")
	}
	url := strings.TrimRight(*smokeURL, "/") + path
	// Auto-retry on 429 with the server-advertised retry-after so the smoke
	// suite doesn't trip its own rate limiter against real prod.
	for attempt := 0; attempt < 5; attempt++ {
		resp, err := client().Get(url)
		if err != nil {
			t.Fatalf("GET %s: %v", url, err)
		}
		body, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusTooManyRequests {
			return resp.StatusCode, string(body)
		}
		// Honour Retry-After if present, else exponential backoff.
		wait := time.Duration(1<<attempt) * time.Second
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			if secs, perr := strconv.Atoi(ra); perr == nil && secs > 0 {
				wait = time.Duration(secs) * time.Second
			}
		}
		time.Sleep(wait)
	}
	t.Fatalf("GET %s: still 429 after 5 retries", url)
	return 0, ""
}

func TestSmoke_Health(t *testing.T) {
	code, body := get(t, "/health")
	if code != http.StatusOK {
		t.Fatalf("health: status=%d body=%s", code, body)
	}
	if !strings.Contains(strings.ToLower(body), "ok") &&
		!strings.Contains(strings.ToLower(body), "healthy") &&
		!strings.Contains(body, "status") {
		t.Fatalf("health: unexpected body: %s", body)
	}
}

func TestSmoke_DashboardLoads(t *testing.T) {
	code, body := get(t, "/")
	if code != http.StatusOK {
		t.Fatalf("dashboard: status=%d", code)
	}
	if !strings.Contains(body, "<html") && !strings.Contains(body, "<!DOCTYPE") {
		t.Fatalf("dashboard: not HTML, first 200 chars: %s", body[:min(200, len(body))])
	}
}

func TestSmoke_APIConnections(t *testing.T) {
	code, body := get(t, "/api/v1/connections")
	if code != http.StatusOK && code != http.StatusUnauthorized {
		t.Fatalf("connections: unexpected status=%d body=%s", code, body)
	}
}

func TestSmoke_UnknownRoute404(t *testing.T) {
	code, _ := get(t, "/api/v1/no-such-route-exists")
	if code != http.StatusNotFound && code != http.StatusUnauthorized {
		t.Fatalf("expected 404 or 401, got %d", code)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func TestMain(m *testing.M) {
	flag.Parse()
	fmt.Printf("smoke target: %s\n", *smokeURL)
	m.Run()
}
