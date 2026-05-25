package api

import (
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// OnboardingStep is one item in the progress list returned by
// /api/v1/onboarding/progress. The frontend renders steps in
// order with a checkmark on Done and a CTA button on the next
// not-yet-done step.
type OnboardingStep struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Done   bool   `json:"done"`
	CTAURL string `json:"cta_url,omitempty"`
}

// OnboardingProgress is the response payload.
type OnboardingProgress struct {
	Steps     []OnboardingStep `json:"steps"`
	Completed int              `json:"completed"`
	Total     int              `json:"total"`
}

// handleOnboardingProgress returns the per-tenant activation
// progress. Replaces the previous single-shot suggested-lists
// fetch as the dashboard's onboarding source.
func handleOnboardingProgress(
	tenants storage.TenantRepository,
	screenings storage.ScreeningRepository,
	webhooks *WebhookSecretStore,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			Error(w, "UNAUTHORIZED", "missing claims", http.StatusUnauthorized)
			return
		}
		tid, err := domain.NewTenantID(claims.TenantID)
		if err != nil {
			Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
			return
		}
		Success(w, computeProgress(tid, tenants, screenings, webhooks),
			http.StatusOK)
	}
}

func computeProgress(
	tid domain.TenantID,
	tenants storage.TenantRepository,
	screenings storage.ScreeningRepository,
	webhooks *WebhookSecretStore,
) OnboardingProgress {
	steps := []OnboardingStep{
		profileStep(tid, tenants),
		listsStep(tid, tenants),
		firstScreenStep(tid, screenings),
		webhookStep(tid, webhooks),
	}
	completed := 0
	for _, s := range steps {
		if s.Done {
			completed++
		}
	}
	return OnboardingProgress{
		Steps: steps, Completed: completed, Total: len(steps),
	}
}
