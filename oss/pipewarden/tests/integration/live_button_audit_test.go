// Live-worker UI button audit. Walks every endpoint the SPA hits and
// verifies each one against the deployed Cloudflare worker. Run via:
//
//	go test ./tests/integration/ -run TestLiveButtonAudit \
//	   -args -smoke-url=https://pipewarden.broad-dew-49ad.workers.dev
//
// Skipped if -smoke-url is not passed.
package integration

import (
	"net/http"
	"strings"
	"testing"
	"time"
)

type buttonCall struct {
	method string
	path   string
	body   string
	// Acceptable status codes. Empty = any non-5xx + non-zero is OK.
	// Use this to encode "auth gate" expectations (401, 403 are valid).
	allow []int
}

// allCalls mirrors internal/router/router_ui_button_audit_test.go but targets
// the live worker. Status expectations are relaxed: anything in [200,499]
// counts (auth/validation rejections are normal for unauthenticated probes).
// Only 5xx + transport errors fail the test.
var allCalls = []buttonCall{
	// Public surfaces — must be 200.
	{"GET", "/health", "", []int{200}},
	{"GET", "/readiness", "", []int{200}},
	{"GET", "/api/v1/status", "", []int{200}},
	{"GET", "/llms.txt", "", []int{200}},
	{"GET", "/.well-known/ai-plugin.json", "", []int{200}},
	{"GET", "/.well-known/security.txt", "", []int{200}},
	{"GET", "/api/v1/openapi.json", "", []int{200}},
	{"GET", "/api/v1/security/audit", "", []int{200}},
	{"GET", "/api/v1/cost-summary", "", []int{200}},
	{"GET", "/api/v1/badge/demo.svg", "", []int{200}},
	{"GET", "/api/v1/og/demo.svg", "", []int{200}},
	{"GET", "/api/v1/docs", "", []int{200}},
	{"GET", "/metrics", "", []int{200}},
	{"GET", "/api/v1/embed/findings", "", []int{200}},
	{"GET", "/api/v1/embed/summary", "", []int{200}},
	{"GET", "/api/v1/embed/config", "", []int{200}},

	// Dashboard / analytics — 200 (or 401 if auth-gated; current build is not).
	{"GET", "/api/v1/connections", "", nil},
	{"GET", "/api/v1/providers", "", []int{200}},
	{"GET", "/api/v1/providers/status", "", nil},
	{"GET", "/api/v1/dashboard/overview", "", nil},
	{"GET", "/api/v1/analysis/findings", "", nil},
	{"GET", "/api/v1/analysis/history", "", nil},
	{"GET", "/api/v1/analysis/stats", "", nil},
	{"GET", "/api/v1/analytics/trends?days=30", "", nil},
	{"GET", "/api/v1/analytics/summary", "", nil},
	{"GET", "/api/v1/analytics/top-findings?limit=8", "", nil},
	{"GET", "/api/v1/policies", "", nil},
	{"GET", "/api/v1/policies/custom", "", nil},
	{"GET", "/api/v1/secrets", "", nil},
	{"GET", "/api/v1/secrets/summary", "", nil},
	{"GET", "/api/v1/notifications", "", nil},
	{"GET", "/api/v1/notifications/count", "", nil},
	{"GET", "/api/v1/team/members", "", nil},
	{"GET", "/api/v1/audit", "", nil},
	{"GET", "/api/v1/webhooks/templates", "", nil},
	{"GET", "/api/v1/semgrep/rules", "", nil},

	// OAuth + auth endpoints — usually 400/401/403/503 without credentials.
	{"GET", "/api/v1/oauth/github/status", "", nil},
	{"GET", "/api/v1/auth/me", "", nil},
	{"GET", "/api/v1/auth/settings", "", nil},
	{"GET", "/api/v1/auth/passkeys", "", nil},
	{"GET", "/api/v1/auth/recovery/status", "", nil},
	{"GET", "/api/v1/auth/github/start", "", nil},

	// Mutating endpoints — submit empty body, expect 4xx but no 5xx.
	{"POST", "/api/v1/connections/test", "{}", nil},
	{"POST", "/api/v1/connections/demo/test", "", nil},
	{"GET", "/api/v1/connections/demo/health", "", nil},
	{"GET", "/api/v1/connections/demo/schedule", "", nil},
	{"GET", "/api/v1/analysis/findings/export?format=csv", "", nil},
	{"POST", "/api/v1/analysis/run", `{"connection":"demo"}`, nil},
	{"POST", "/api/v1/analysis/quick", `{"connection":"demo"}`, nil},
	{"POST", "/api/v1/findings/1/suppress", `{"reason":"x"}`, nil},
	{"POST", "/api/v1/findings/1/reopen", "", nil},
	{"GET", "/api/v1/findings/1/similar?k=5", "", nil},
	{"GET", "/api/v1/findings/1/fix", "", nil},
	{"GET", "/api/v1/pipelines?connection=demo&owner=o&repo=r", "", nil},
	{"GET", "/api/v1/pipelines/runs?connection=demo&owner=o&repo=r&limit=10", "", nil},
	{"POST", "/api/v1/dlp/scan", `{"content":"x"}`, nil},
	{"POST", "/api/v1/policy/evaluate", "{}", nil},
	{"POST", "/api/v1/sca/scan", `{"logs":"x"}`, nil},
	{"POST", "/api/v1/egress/discover", "{}", nil},
	{"POST", "/api/v1/demo/workspace", "", nil},
	{"POST", "/api/v1/auth/signup", `{"email":"u@x.com","password":"longenoughpass"}`, nil},
	{"POST", "/api/v1/auth/login", `{"email":"u@x.com","password":"longenoughpass"}`, nil},
	{"POST", "/api/v1/auth/logout", "", nil},
	{"POST", "/api/v1/auth/passkey/login/begin", "{}", nil},
	{"POST", "/api/v1/auth/verify/request", "", nil},
	{"GET", "/api/v1/auth/verify/confirm?token=x", "", nil},
	{"POST", "/api/v1/auth/password/reset/begin", `{"email":"u@x.com"}`, nil},
	{"POST", "/api/v1/billing/checkout", `{"plan":"pro"}`, nil},
	{"POST", "/api/waitlist", `{"email":"u@x.com"}`, nil},
}

func TestLiveButtonAudit(t *testing.T) {
	if *smokeURL == "" {
		t.Skip("set -smoke-url to run against live worker")
	}
	base := strings.TrimRight(*smokeURL, "/")
	cl := &http.Client{Timeout: 20 * time.Second}

	failed := 0
	for _, c := range allCalls {
		c := c
		t.Run(c.method+" "+c.path, func(t *testing.T) {
			// Pace requests under the prod rate limit (20 req/min default).
			time.Sleep(3500 * time.Millisecond)

			var req *http.Request
			var err error
			if c.body != "" {
				req, err = http.NewRequest(c.method, base+c.path, strings.NewReader(c.body))
				if err == nil {
					req.Header.Set("Content-Type", "application/json")
				}
			} else {
				req, err = http.NewRequest(c.method, base+c.path, nil)
			}
			if err != nil {
				t.Fatalf("build req: %v", err)
			}

			// Retry on 429 with backoff.
			var resp *http.Response
			for attempt := 0; attempt < 4; attempt++ {
				resp, err = cl.Do(req.Clone(req.Context()))
				if err != nil {
					t.Fatalf("transport: %v", err)
				}
				if resp.StatusCode != http.StatusTooManyRequests {
					break
				}
				_ = resp.Body.Close()
				time.Sleep(time.Duration(2<<attempt) * time.Second)
			}
			defer func() { _ = resp.Body.Close() }()

			// 503 (Service Unavailable) is acceptable — handlers return it
			// intentionally when a feature's credential is not configured
			// (e.g. /api/v1/auth/github/start without GITHUB_CLIENT_ID).
			// 500+ is always a failure: production should never crash on
			// well-formed requests, even unauthenticated ones.
			if resp.StatusCode >= 500 && resp.StatusCode != http.StatusServiceUnavailable {
				failed++
				t.Fatalf("%s %s: status %d (5xx — production crashed)", c.method, c.path, resp.StatusCode)
			}

			if len(c.allow) > 0 {
				ok := false
				for _, s := range c.allow {
					if resp.StatusCode == s {
						ok = true
						break
					}
				}
				if !ok {
					failed++
					t.Fatalf("%s %s: status %d not in allowed set %v", c.method, c.path, resp.StatusCode, c.allow)
				}
			}
		})
	}
}
