package api

import (
	"github.com/aegis-aml/aegis/internal/analytics"
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// trackEvent fans an event into a goroutine so the request thread
// is never delayed by the analytics sink. Safe with NoopSink (the
// default) — the goroutine still spawns but Emit is a single map
// allocation and a return.
func trackEvent(name, distinctID string, props map[string]interface{}) {
	go analytics.Default().Emit(analytics.Event{
		Name: name, DistinctID: distinctID, Properties: props,
	})
}

func trackSignup(tenantID, country string) {
	trackEvent(analytics.EventAuthSignup, tenantID, map[string]interface{}{
		"country": country, "source": "api/auth/signup",
	})
}

func trackLogin(tenantID, userID string) {
	trackEvent(analytics.EventAuthLogin, tenantID, map[string]interface{}{
		"user_id": userID,
	})
}

func trackUsageExhausted(tenantID, code string) {
	trackEvent(analytics.EventUsageExhausted, tenantID, map[string]interface{}{
		"code": code,
	})
}

// trackScreen emits both the always-on screen.executed event and a
// one-shot screen.first event when the tenant's screening repo
// previously held zero rows. The count read happens after the
// repo write, so first-screen detection requires the row to be
// recorded synchronously by the handler — true today.
func trackScreen(
	tenantID domain.TenantID, screenings storage.ScreeningRepository,
) {
	rows, err := screenings.ListByTenant(tenantID)
	if err != nil {
		return
	}
	count := len(rows)
	props := map[string]interface{}{"n_today": count}
	trackEvent(analytics.EventScreenExecuted, tenantID.String(), props)
	if count == 1 {
		trackEvent(analytics.EventScreenFirst, tenantID.String(), nil)
	}
}
