package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/automation"
	"github.com/aegis-aml/aegis/internal/config"
	"github.com/aegis-aml/aegis/internal/ingestion"
)

func SetupRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
	authCfg config.AuthConfig,
	oauthCfg config.OAuthConfig,
) {
	setupAuthRoutes(mux, deps.Users, deps.Tenants, authChain, authCfg.TokenSecret, authCfg.TokenExpiry, oauthCfg)
	setupAuthResetRoutes(mux, deps.DB, deps.Users, authChain, authCfg.TokenSecret)
	screenHandler := NewScreenHandler(
		deps.Entities, deps.Screenings, deps.Alerts,
		deps.Audit, deps.Tenants, deps.Engine,
	).WithExternalEnricher(ingestion.NewExternalEnricherFromEnv())
	screenDemoHandler := NewScreenDemoHandler(deps.Entities, deps.Engine)
	alertHandler := NewAlertHandler(deps.Alerts, deps.Audit)
	listsHandler := NewListsHandler(deps.Tenants, deps.Entities)
	analyticsHandler := NewAnalyticsHandler(deps.Screenings, deps.Alerts)
	auditHandler := NewAuditHandler(deps.Audit)
	configHandler := NewConfigHandler(deps.Tenants, deps.Audit)

	usageCheck := UsageEnforcementMiddleware(deps.Enforcer)
	mux.Handle("POST /api/v1/screen",
		authChain(usageCheck(http.HandlerFunc(screenHandler.Screen))))
	mux.Handle("GET /api/v1/screen/{id}",
		authChain(http.HandlerFunc(screenHandler.GetScreening)))
	mux.Handle("GET /api/v1/screening/quota",
		authChain(http.HandlerFunc(handleScreeningQuota(deps.Enforcer))))

	mux.Handle("GET /api/v1/alerts",
		authChain(http.HandlerFunc(alertHandler.ListAlerts)))
	mux.Handle("GET /api/v1/alerts/stream",
		authChain(http.HandlerFunc(alertHandler.Stream)))
	mux.Handle("GET /api/v1/alerts/{id}",
		authChain(http.HandlerFunc(alertHandler.GetAlert)))
	writeOnly := WriteAccess()
	mux.Handle("PUT /api/v1/alerts/{id}/resolve",
		authChain(writeOnly(http.HandlerFunc(alertHandler.ResolveAlert))))

	mux.Handle("POST /api/v1/screen/demo",
		authChain(usageCheck(http.HandlerFunc(screenDemoHandler.Screen))))
	// Public-demo: fixture-backed handler in internal/screening/publicdemo
	// is the canonical implementation. It falls back to the legacy
	// DB-backed PublicScreenDemo only if samples/screen/ fails to load.
	mux.HandleFunc("POST /api/v1/screen/public-demo",
		NewPublicDemoHandler(deps.Engine,
			PublicScreenDemo(deps.Entities, deps.Engine)))
	// Free-text screening is unauthenticated: gate per-IP through the
	// shared public-demo limiter so it cannot be used as a free
	// uncapped search bypass for the auth'd /screen/freetext route.
	mux.HandleFunc("POST /api/v1/screen/freetext",
		ipRateLimited(freeTextScreenHandler(deps.Entities, deps.Engine)))

	mux.Handle("GET /api/v1/lists",
		authChain(http.HandlerFunc(listsHandler.ListMetadata)))
	mux.Handle("GET /api/v1/lists/{id}",
		authChain(http.HandlerFunc(listsHandler.GetListMetadata)))

	if deps.SyncSvc != nil {
		syncHandler := NewSyncListHandler(deps.Tenants, deps.SyncSvc, deps.Audit)
		mux.Handle("POST /api/v1/lists/{id}/sync",
			authChain(http.HandlerFunc(syncHandler.TriggerSync)))
	}

	mux.Handle("GET /api/v1/analytics",
		authChain(http.HandlerFunc(analyticsHandler.Dashboard)))
	mux.Handle("GET /api/v1/audit",
		authChain(http.HandlerFunc(auditHandler.ListAuditTrail)))
	mux.Handle("GET /api/v1/audit/{id}",
		authChain(http.HandlerFunc(auditHandler.GetAuditEntry)))

	mux.Handle("GET /api/v1/config",
		authChain(http.HandlerFunc(configHandler.GetConfig)))
	configAdmin := AdminOnly()
	mux.Handle("PUT /api/v1/config",
		authChain(configAdmin(http.HandlerFunc(configHandler.UpdateConfig))))

	setupScreeningConfigRoutes(mux, authChain, configAdmin)

	dashHandler := NewDashboardHandler(
		deps.CaseQueries, deps.Monitors, deps.Media, deps.TxnAlerts,
	)
	mux.Handle("GET /api/v1/dashboard/compliance",
		authChain(http.HandlerFunc(dashHandler.ComplianceStats)))

	mux.HandleFunc("GET /api/v1/onboarding/lists", handleSuggestedLists)
	mux.Handle("GET /api/v1/onboarding/progress",
		authChain(handleOnboardingProgress(deps.Tenants, deps.Screenings, deps.WebhookSecrets)))
	mux.HandleFunc("GET /api/v1/marketing/claims", handleMarketingClaims)
	// Fast payment screening
	if deps.FastEngine != nil {
		mux.Handle("POST /api/v1/screen/fast",
			authChain(usageCheck(http.HandlerFunc(handleFastScreen(deps.FastEngine, deps.Entities)))))
	}

	// Crypto wallet screening
	if deps.CryptoIdx != nil {
		ch := NewCryptoScreenHandler(deps.CryptoIdx, deps.Engine)
		mux.Handle("POST /api/v1/crypto/screen",
			authChain(usageCheck(http.HandlerFunc(ch.Screen))))
		mux.HandleFunc("POST /api/v1/crypto/screen/public",
			publicCryptoScreen(deps.CryptoIdx))
	}

	setupMarketplaceRoutes(mux, deps, authChain)
	setupBatchRoutes(mux, deps, authChain)
	setupDatasetRoutes(mux, deps, authChain)
	setupExportRoutes(mux, deps, authChain)
	setupHealthRoutes(mux, deps)
	setupBillingRoutes(mux, deps, authChain)
	setupAdminRoutes(mux, deps, authChain)
	setupAdminOpsRoutes(mux, deps, authChain)
	setupTeamRoutes(mux, deps, authChain)
	setupWidgetRoutes(mux, deps)
	setupEntityRoutes(mux, deps, authChain)
	setupComplianceRoutes(mux, deps, authChain)
	setupPlatformRoutes(mux, deps, authChain)
	setupTxnRoutes(mux, deps, authChain)
	notifH := NewNotificationHandler(deps.Audit)
	mux.Handle("GET /api/v1/notifications",
		authChain(http.HandlerFunc(notifH.List)))
	setupAPIKeyRoutes(mux, deps, authChain)
	if deps.Screenings != nil {
		ish := NewImpaSARHandler(deps.Screenings)
		mux.Handle("GET /api/v1/reports/impa-sar/{id}",
			authChain(http.HandlerFunc(ish.Get)))
	}
	setupPrivacyRoutes(mux, deps, authChain)
	setupWebhookRoutes(mux, authChain)
	setupMonitorProfileRoutes(mux, deps, authChain)
	setupDocsRoutes(mux)
	setupAgentRoutes(mux, deps, authChain)
	setupAIRoutes(mux, deps, authChain)
	setupSSORoutes(mux, deps.DB)

	if deps.WebhookSecrets == nil {
		deps.WebhookSecrets = NewWebhookSecretStore()
	}
	if deps.AutomationRules == nil {
		deps.AutomationRules = automation.NewInMemoryStore()
	}
	SetupIngestAndAutomationRoutes(mux, deps, authChain,
		deps.WebhookSecrets, deps.AutomationRules)
}
