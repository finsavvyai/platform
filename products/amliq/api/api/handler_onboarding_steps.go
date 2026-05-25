package api

import (
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func profileStep(tid domain.TenantID, tenants storage.TenantRepository) OnboardingStep {
	t, _ := tenants.GetByID(tid)
	done := t != nil && t.Name != "" && !t.ID.IsZero()
	return OnboardingStep{
		ID: "profile", Title: "Set up your organisation profile",
		Done: done, CTAURL: "/dashboard/settings",
	}
}

func listsStep(tid domain.TenantID, tenants storage.TenantRepository) OnboardingStep {
	t, _ := tenants.GetByID(tid)
	done := t != nil && len(t.Config.EnabledLists) > 0
	return OnboardingStep{
		ID: "lists", Title: "Pick the sanctions lists for your jurisdiction",
		Done: done, CTAURL: "/dashboard/lists",
	}
}

func firstScreenStep(tid domain.TenantID, screenings storage.ScreeningRepository) OnboardingStep {
	rows, _ := screenings.ListByTenant(tid)
	return OnboardingStep{
		ID: "first_screen", Title: "Run your first screen",
		Done: len(rows) > 0, CTAURL: "/dashboard/screen",
	}
}

func webhookStep(tid domain.TenantID, webhooks *WebhookSecretStore) OnboardingStep {
	done := webhooks != nil && webhooks.Has(tid.String())
	return OnboardingStep{
		ID: "webhook", Title: "Configure a webhook for monitoring alerts",
		Done: done, CTAURL: "/dashboard/webhooks",
	}
}
