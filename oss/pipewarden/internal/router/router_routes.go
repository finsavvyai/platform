package router

import (
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/handlers"
	"github.com/finsavvyai/pipewarden/internal/metrics"
	"github.com/finsavvyai/pipewarden/internal/middleware"
	"github.com/finsavvyai/pipewarden/internal/web"
)

// registerRoutes wires every HTTP endpoint on the given mux.
func registerRoutes(mux *http.ServeMux, h *handlers.Handlers) {
	// Health check & status
	mux.HandleFunc("/health", h.Health)
	mux.Handle("/metrics", metrics.Handler())
	mux.HandleFunc("/readiness", h.Health)
	mux.HandleFunc("/api/v1/status", h.Status)

	// Static files + embed widget
	mux.Handle("/static/", middleware.ContentType("text/html; charset=utf-8")(
		http.StripPrefix("/static/", web.DashboardHandler())))
	mux.Handle("/embed", web.EmbedHandler())

	// Connections
	mux.HandleFunc("/api/v1/connections/test", h.TestAllConnections)
	mux.HandleFunc("/api/v1/connections/update", h.UpdateConnection)
	mux.HandleFunc("/api/v1/connections", connHandler(h))
	mux.HandleFunc("/api/v1/connections/", connDetailHandler(h))

	// Finding suppression
	mux.HandleFunc("/api/v1/findings/", findingActionHandler(h))

	// Analysis
	mux.HandleFunc("/api/v1/analysis/run", h.RunAnalysis)
	mux.HandleFunc("/api/v1/analysis/quick", h.QuickAnalysis)
	mux.HandleFunc("/api/v1/analysis/findings/export", h.ExportFindings)
	mux.HandleFunc("/api/v1/findings/search", h.SearchFindings)
	mux.HandleFunc("/api/v1/findings/fix/pr/batch", h.CreateFixPRBatch)
	mux.HandleFunc("/api/v1/analysis/findings", analysisHandler(h))
	mux.HandleFunc("/api/v1/analysis/findings/", analysisHandler(h))
	mux.HandleFunc("/api/v1/analysis/history", h.ListHistory)
	mux.HandleFunc("/api/v1/analysis/stats", h.GetStats)

	// Pipelines
	mux.HandleFunc("/api/v1/pipelines/runs", h.ListPipelineRuns)
	mux.HandleFunc("/api/v1/pipelines", h.ListPipelines)

	// Providers
	mux.HandleFunc("/api/v1/providers", h.GetProviders)
	mux.HandleFunc("/api/v1/providers/status", h.GetProvidersStatus)

	// Analytics
	mux.HandleFunc("/api/v1/analytics/trends", h.GetTrends)
	mux.HandleFunc("/api/v1/analytics/summary", h.GetSummary)
	mux.HandleFunc("/api/v1/analytics/top-findings", h.GetTopFindings)

	// Dashboard
	mux.HandleFunc("/api/v1/dashboard/overview", h.DashboardOverview)

	registerOAuthRoutes(mux, h)
	registerBillingRoutes(mux, h)
	registerAuthRoutes(mux, h)
	registerAdminRoutes(mux, h)
}

// registerOAuthRoutes wires GitHub App OAuth + embed + billing checkout.
func registerOAuthRoutes(mux *http.ServeMux, h *handlers.Handlers) {
	mux.HandleFunc("/api/v1/oauth/github/install", h.InstallGitHubApp)
	mux.HandleFunc("/api/v1/oauth/github/status", h.GitHubAppStatus)
	mux.HandleFunc("/api/v1/oauth/github/callback", h.HandleGitHubCallback)
	mux.HandleFunc("/api/v1/oauth/github/webhook", h.HandleGitHubWebhook)
	mux.HandleFunc("/api/v1/oauth/github/installations", h.ListGitHubInstallations)

	// Embed widget API
	mux.HandleFunc("/api/v1/embed/findings", h.EmbedFindings)
	mux.HandleFunc("/api/v1/embed/summary", h.EmbedSummary)
	mux.HandleFunc("/api/v1/embed/config", h.EmbedConfig)
}

// registerBillingRoutes wires LemonSqueezy billing + waitlist + SSE + trace.
func registerBillingRoutes(mux *http.ServeMux, h *handlers.Handlers) {
	mux.HandleFunc("/api/v1/billing/checkout", h.CreateCheckoutSession)
	mux.HandleFunc("/api/v1/billing/webhook", h.HandleBillingWebhook)

	mux.HandleFunc("/api/waitlist", h.JoinWaitlist)
	mux.HandleFunc("/api/v1/waitlist", h.JoinWaitlist)

	mux.HandleFunc("/api/v1/scan/", h.StreamScanProgress)
	mux.HandleFunc("/api/v1/trace/latest", h.LatestTrace)

	// Semgrep
	mux.HandleFunc("/api/v1/semgrep/rules", h.SemgrepRulesHandler)
	mux.HandleFunc("/api/v1/semgrep/rules/", h.SemgrepRulesHandler)

	// DLP + policy
	mux.HandleFunc("/api/v1/dlp/scan", h.ScanDLP)
	mux.HandleFunc("/api/v1/policy/evaluate", h.EvaluatePolicy)

	// Custom policies
	mux.HandleFunc("/api/v1/policies", policyCollectionHandler(h))
	mux.HandleFunc("/api/v1/policies/", policyDetailHandler(h))

	// Webhooks
	mux.HandleFunc("/api/v1/webhooks/configure", h.ConfigureWebhook)
	mux.HandleFunc("/api/v1/webhooks/test", h.TestWebhook)
	mux.HandleFunc("/api/v1/webhooks/templates", webhookTemplateCollectionHandler(h))
	mux.HandleFunc("/api/v1/webhooks/templates/", webhookTemplateDetailHandler(h))
	mux.HandleFunc("/api/v1/webhooks/github", h.InboundGitHubWebhook)
	mux.HandleFunc("/api/v1/webhooks/gitlab", h.InboundGitLabWebhook)
	mux.HandleFunc("/api/v1/webhooks/github/pr-comment", h.PostPRComment)

	// Demo + compliance
	mux.HandleFunc("/api/v1/demo/workspace", h.LoadDemoWorkspace)
	mux.HandleFunc("/api/v1/compliance/", h.GenerateComplianceReport)

	// Secret lifecycle
	mux.HandleFunc("/api/v1/secrets/summary", h.SecretLifecycleSummary)
	mux.HandleFunc("/api/v1/secrets/", secretLifecycleActionHandler(h))
	mux.HandleFunc("/api/v1/secrets", h.ListSecretLifecycle)

	// API docs
	mux.HandleFunc("/api/v1/docs", h.APIDocs)

	// Viral surfaces
	mux.HandleFunc("/llms.txt", h.LLMsTxt)
	mux.HandleFunc("/.well-known/ai-plugin.json", h.AIPluginManifest)
	mux.HandleFunc("/api/v1/badge/", h.BadgeSVG)
	mux.HandleFunc("/api/v1/og/", h.OGCardSVG)
	mux.HandleFunc("/api/v1/openapi.json", h.OpenAPIJSON)
	mux.HandleFunc("/api/v1/security/audit", h.SecurityAudit)
	mux.HandleFunc("/api/v1/cost-summary", h.CostSummary)
	mux.HandleFunc("/api/v1/egress/discover", h.EgressDiscover)
	mux.HandleFunc("/api/v1/sca/scan", h.SCAScan)
	mux.HandleFunc("/api/v1/git/scan", h.GitHistoryScan)
	mux.HandleFunc("/.well-known/security.txt", h.SecurityTxt)
}

// registerAuthRoutes wires native auth, GitHub SSO, passkeys, TOTP, email verify.
func registerAuthRoutes(mux *http.ServeMux, h *handlers.Handlers) {
	mux.HandleFunc("/api/v1/auth/signup", h.AuthSignup)
	mux.HandleFunc("/api/v1/auth/login", h.AuthLogin)
	mux.HandleFunc("/api/v1/auth/logout", h.AuthLogout)
	mux.HandleFunc("/api/v1/auth/me", h.AuthMe)
	mux.HandleFunc("/api/v1/auth/onboarding", h.AuthOnboarding)

	// GitHub identity (not CI/CD installation)
	mux.HandleFunc("/api/v1/auth/github/start", h.AuthGitHubStart)
	mux.HandleFunc("/api/v1/auth/github/callback", h.AuthGitHubCallback)

	// Passkey (WebAuthn)
	mux.HandleFunc("/api/v1/auth/passkey/register/begin", h.AuthPasskeyRegisterBegin)
	mux.HandleFunc("/api/v1/auth/passkey/register/finish", h.AuthPasskeyRegisterFinish)
	mux.HandleFunc("/api/v1/auth/passkey/login/begin", h.AuthPasskeyLoginBegin)
	mux.HandleFunc("/api/v1/auth/passkey/login/finish", h.AuthPasskeyLoginFinish)

	// Email verification + password reset
	mux.HandleFunc("/api/v1/auth/verify/request", h.AuthVerifyRequest)
	mux.HandleFunc("/api/v1/auth/verify/confirm", h.AuthVerifyConfirm)
	mux.HandleFunc("/api/v1/auth/password/reset/begin", h.AuthPasswordResetBegin)
	mux.HandleFunc("/api/v1/auth/password/reset/finish", h.AuthPasswordResetFinish)

	// TOTP 2FA
	mux.HandleFunc("/api/v1/auth/totp/setup", h.AuthTOTPSetup)
	mux.HandleFunc("/api/v1/auth/totp/verify", h.AuthTOTPVerify)
	mux.HandleFunc("/api/v1/auth/totp/disable", h.AuthTOTPDisable)
	mux.HandleFunc("/api/v1/auth/recovery/generate", h.AuthRecoveryGenerate)
	mux.HandleFunc("/api/v1/auth/recovery/status", h.AuthRecoveryStatus)

	// Account settings
	mux.HandleFunc("/api/v1/auth/settings", h.AuthSettings)
	mux.HandleFunc("/api/v1/auth/passkeys", h.AuthListPasskeys)
	mux.HandleFunc("/api/v1/auth/passkeys/", h.AuthDeletePasskey)
}

// registerAdminRoutes wires team, audit, SSO, and notification endpoints.
func registerAdminRoutes(mux *http.ServeMux, h *handlers.Handlers) {
	mux.HandleFunc("/api/v1/team/members", teamMembersHandler(h))
	mux.HandleFunc("/api/v1/team/members/", teamMemberDetailHandler(h))

	mux.HandleFunc("/api/v1/audit", h.ListAuditLog)
	mux.HandleFunc("/api/v1/audit/internal", h.IngestInternalAudit)
	mux.HandleFunc("/api/v1/admin/sso/test", h.TestSSOMetadata)

	mux.HandleFunc("/api/v1/notifications/count", h.NotificationCount)
	mux.HandleFunc("/api/v1/notifications/read-all", h.MarkAllNotificationsRead)
	mux.HandleFunc("/api/v1/notifications/", notificationActionHandler(h))
	mux.HandleFunc("/api/v1/notifications", h.ListNotifications)
}
