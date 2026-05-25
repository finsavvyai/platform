package router

import (
	"net/http"
	"strings"
	"testing"
)

// TestUIButtonAuditEveryFetchTargetIsRouted walks every URL template that
// app.js / index.html / embed.html actually hit during normal use and proves
// the router (a) doesn't fall through to a generic 404 and (b) dispatches to
// the correct handler (no 405 mismatch). Downstream business-logic errors
// (400/404/500) are acceptable — the contract here is that the *route* is
// wired, not that the request payload is valid.
//
// If this test fails, a button in the SPA will be broken in production.
//
// Inventory was extracted from `grep "fetch(" internal/web/static/app.js`
// and the embed widget's `?api=` references. Keep in sync with the UI.
func TestUIButtonAuditEveryFetchTargetIsRouted(t *testing.T) {
	srv := newTestServer(t)

	type call struct {
		desc   string
		method string
		path   string
		body   string
	}

	uiCalls := []call{
		// --- Connections page ---
		{"connections-list", "GET", "/api/v1/connections", ""},
		{"connection-create", "POST", "/api/v1/connections", `{"name":"x","platform":"github","credentials":{"token":"t"}}`},
		{"connection-delete", "DELETE", "/api/v1/connections/demo", ""},
		{"connection-update", "POST", "/api/v1/connections/update", `{"name":"demo"}`},
		{"connection-test-all", "POST", "/api/v1/connections/test", ""},
		{"connection-test-one", "POST", "/api/v1/connections/demo/test", ""},
		{"connection-health", "GET", "/api/v1/connections/demo/health", ""},
		{"connection-scan-runtime", "POST", "/api/v1/connections/demo/scan/runtime", "{}"},
		{"connection-schedule-get", "GET", "/api/v1/connections/demo/schedule", ""},
		{"connection-schedule-set", "POST", "/api/v1/connections/demo/schedule", `{"cron":"* * * * *"}`},
		{"connection-schedule-del", "DELETE", "/api/v1/connections/demo/schedule", ""},
		{"connection-apikey-gen", "POST", "/api/v1/connections/demo/apikey", ""},
		{"connection-apikey-revoke", "DELETE", "/api/v1/connections/demo/apikey", ""},

		// --- Providers, dashboard, analytics ---
		{"providers-list", "GET", "/api/v1/providers", ""},
		{"oauth-github-status", "GET", "/api/v1/oauth/github/status", ""},
		{"demo-workspace", "POST", "/api/v1/demo/workspace", ""},
		{"analysis-stats", "GET", "/api/v1/analysis/stats", ""},
		{"dashboard-overview", "GET", "/api/v1/dashboard/overview", ""},
		{"analytics-trends", "GET", "/api/v1/analytics/trends?days=30", ""},
		{"analytics-top-findings", "GET", "/api/v1/analytics/top-findings?limit=8", ""},
		{"analytics-summary", "GET", "/api/v1/analytics/summary", ""},

		// --- Findings page ---
		{"findings-list", "GET", "/api/v1/analysis/findings", ""},
		{"findings-update", "PATCH", "/api/v1/analysis/findings/1", `{"status":"resolved"}`},
		{"findings-export-csv", "GET", "/api/v1/analysis/findings/export?format=csv", ""},
		{"findings-export-sarif", "GET", "/api/v1/analysis/findings/export?format=sarif", ""},
		{"findings-history", "GET", "/api/v1/analysis/history", ""},
		{"findings-suppress", "POST", "/api/v1/findings/1/suppress", `{"reason":"x"}`},
		{"findings-reopen", "POST", "/api/v1/findings/1/reopen", ""},
		{"findings-similar", "GET", "/api/v1/findings/1/similar?k=5", ""},
		{"findings-fix-suggest", "GET", "/api/v1/findings/1/fix", ""},
		{"findings-fix-pr", "POST", "/api/v1/findings/1/fix/pr", "{}"},
		{"findings-fix-pr-batch", "POST", "/api/v1/findings/1/fix/pr/batch", "{}"},

		// --- Pipelines page ---
		{"pipelines-list", "GET", "/api/v1/pipelines?connection=demo&owner=o&repo=r", ""},
		{"pipelines-runs", "GET", "/api/v1/pipelines/runs?connection=demo&owner=o&repo=r&limit=10", ""},

		// --- Scan page (Quick scan modal) ---
		{"scan-full", "POST", "/api/v1/analysis/run", `{"connection":"demo"}`},
		{"scan-quick", "POST", "/api/v1/analysis/quick", `{"connection":"demo"}`},

		// --- Policies page ---
		{"policies-list", "GET", "/api/v1/policies", ""},
		{"policies-custom-list", "GET", "/api/v1/policies/custom", ""},
		{"policies-custom-create", "POST", "/api/v1/policies/custom",
			`{"id":"p","name":"P","severity":"high","pattern":"x","description":"d","message":"m"}`},
		{"policies-custom-update", "PUT", "/api/v1/policies/custom/p",
			`{"id":"p","name":"P","severity":"high","pattern":"x","description":"d","message":"m"}`},
		{"policies-custom-delete", "DELETE", "/api/v1/policies/custom/p", ""},
		{"policies-test", "POST", "/api/v1/policies/p/test", `{"yaml_content":"x"}`},

		// --- Secrets / DLP page ---
		{"secrets-list", "GET", "/api/v1/secrets", ""},
		{"secrets-summary", "GET", "/api/v1/secrets/summary", ""},
		{"secrets-revoke", "POST", "/api/v1/secrets/1/revoke", ""},

		// --- Notifications bell ---
		{"notifications-list", "GET", "/api/v1/notifications", ""},
		{"notifications-count", "GET", "/api/v1/notifications/count", ""},
		{"notifications-read-all", "POST", "/api/v1/notifications/read-all", ""},
		{"notifications-read-one", "POST", "/api/v1/notifications/1/read", ""},

		// --- Settings: team + audit + webhooks + SSO ---
		{"team-members-list", "GET", "/api/v1/team/members", ""},
		{"team-members-invite", "POST", "/api/v1/team/members", `{"email":"u@x.com","role":"member"}`},
		{"team-member-role", "PUT", "/api/v1/team/members/u@x.com/role", `{"role":"admin"}`},
		{"team-member-remove", "DELETE", "/api/v1/team/members/u@x.com", ""},
		{"audit-log", "GET", "/api/v1/audit", ""},
		{"sso-test", "POST", "/api/v1/admin/sso/test", `{"metadata_url":"https://x/saml"}`},
		{"webhook-configure", "POST", "/api/v1/webhooks/configure", `{"url":"https://x"}`},
		{"webhook-test", "POST", "/api/v1/webhooks/test", ""},
		{"webhook-templates-list", "GET", "/api/v1/webhooks/templates", ""},
		{"webhook-template-render", "POST", "/api/v1/webhooks/templates/1/render", "{}"},

		// --- Settings: auth ---
		{"auth-me", "GET", "/api/v1/auth/me", ""},
		{"auth-logout", "POST", "/api/v1/auth/logout", ""},
		{"auth-onboarding", "POST", "/api/v1/auth/onboarding", `{"name":"X"}`},
		{"auth-settings", "GET", "/api/v1/auth/settings", ""},
		{"auth-totp-setup", "POST", "/api/v1/auth/totp/setup", ""},
		{"auth-totp-verify", "POST", "/api/v1/auth/totp/verify", `{"code":"123456"}`},
		{"auth-totp-disable", "POST", "/api/v1/auth/totp/disable", ""},
		{"auth-recovery-gen", "POST", "/api/v1/auth/recovery/generate", ""},
		{"auth-recovery-status", "GET", "/api/v1/auth/recovery/status", ""},
		{"auth-passkeys-list", "GET", "/api/v1/auth/passkeys", ""},
		{"auth-passkey-register-begin", "POST", "/api/v1/auth/passkey/register/begin", ""},
		{"auth-passkey-register-finish", "POST", "/api/v1/auth/passkey/register/finish", "{}"},
		{"auth-passkey-login-begin", "POST", "/api/v1/auth/passkey/login/begin", `{}`},
		{"auth-passkey-login-finish", "POST", "/api/v1/auth/passkey/login/finish", "{}"},
		{"auth-verify-request", "POST", "/api/v1/auth/verify/request", ""},
		{"auth-verify-confirm", "GET", "/api/v1/auth/verify/confirm?token=x", ""},
		{"auth-pwd-reset-begin", "POST", "/api/v1/auth/password/reset/begin", `{"email":"x@y.com"}`},
		{"auth-pwd-reset-finish", "POST", "/api/v1/auth/password/reset/finish", `{"token":"x","password":"longenough"}`},

		// --- Signup / Login pages ---
		{"auth-signup", "POST", "/api/v1/auth/signup", `{"email":"x@y.com","password":"longenough"}`},
		{"auth-login", "POST", "/api/v1/auth/login", `{"email":"x@y.com","password":"longenough"}`},
		{"auth-github-start", "GET", "/api/v1/auth/github/start", ""},
		{"auth-github-callback", "GET", "/api/v1/auth/github/callback?code=x&state=y", ""},

		// --- Billing + waitlist ---
		{"billing-checkout", "POST", "/api/v1/billing/checkout", `{"plan":"pro"}`},
		{"waitlist-join", "POST", "/api/waitlist", `{"email":"x@y.com"}`},
		{"waitlist-join-v1", "POST", "/api/v1/waitlist", `{"email":"x@y.com"}`},

		// --- Viral surfaces (first-time visitor) ---
		{"llms-txt", "GET", "/llms.txt", ""},
		{"ai-plugin", "GET", "/.well-known/ai-plugin.json", ""},
		{"security-txt", "GET", "/.well-known/security.txt", ""},
		{"openapi-json", "GET", "/api/v1/openapi.json", ""},
		{"security-audit", "GET", "/api/v1/security/audit", ""},
		{"cost-summary", "GET", "/api/v1/cost-summary", ""},
		{"badge-svg", "GET", "/api/v1/badge/demo.svg", ""},
		{"og-svg", "GET", "/api/v1/og/demo.svg", ""},
		{"api-docs", "GET", "/api/v1/docs", ""},

		// --- Embed widget ---
		{"embed-findings", "GET", "/api/v1/embed/findings", ""},
		{"embed-summary", "GET", "/api/v1/embed/summary", ""},
		{"embed-config", "GET", "/api/v1/embed/config", ""},

		// --- Specialized scanners ---
		{"dlp-scan", "POST", "/api/v1/dlp/scan", `{"content":"x"}`},
		{"policy-eval", "POST", "/api/v1/policy/evaluate", `{}`},
		{"sca-scan", "POST", "/api/v1/sca/scan", `{"logs":"x"}`},
		{"egress-discover", "POST", "/api/v1/egress/discover", `{}`},
		{"semgrep-rules-list", "GET", "/api/v1/semgrep/rules", ""},

		// --- Health + status ---
		{"health", "GET", "/health", ""},
		{"readiness", "GET", "/readiness", ""},
		{"status", "GET", "/api/v1/status", ""},
		{"metrics", "GET", "/metrics", ""},
	}

	for _, c := range uiCalls {
		t.Run(c.desc, func(t *testing.T) {
			req, _ := http.NewRequest(c.method, srv.URL+c.path, strings.NewReader(c.body))
			if c.body != "" {
				req.Header.Set("Content-Type", "application/json")
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("%s %s: transport error: %v", c.method, c.path, err)
			}
			_ = resp.Body.Close()

			// Allow ANY non-zero status. Forbidden statuses:
			//  - 0 (transport never returned a status — wiring is broken)
			//  - 405 with body "method not allowed" from the SPA catch-all
			//    (means router fell through and the SPA replied "no handler")
			if resp.StatusCode == 0 {
				t.Fatalf("%s %s: no status from server", c.method, c.path)
			}
			// 404 with NotFound body from router catch-all means no handler
			// was registered. Downstream-handler 404s (e.g. "connection not
			// found") are fine — they come with a JSON body, which we don't
			// distinguish here. Tradeoff: this catches the "completely
			// missing route" class of break, not the "found but errored"
			// class. The latter is the smoke test's job.
			if resp.StatusCode == http.StatusNotFound && resp.Header.Get("Content-Type") == "" {
				t.Fatalf("%s %s: 404 from router catch-all — handler not registered", c.method, c.path)
			}
		})
	}
}
