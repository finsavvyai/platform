package payment

import (
	"strings"
	"testing"
)

// The pricing model collapsed from 6 tiers to 3 public + 1 contact-tier
// per GO_TO_MARKET_PLAN.html. Old IDs (community/starter/professional/
// enterprise_plus) remain as aliases. These tests assert both shapes
// resolve correctly to avoid quietly breaking existing subscriptions.

func TestGetPlanFreeAndCommunityAlias(t *testing.T) {
	for _, id := range []string{"free", "community"} {
		plan, ok := GetPlan(id)
		if !ok {
			t.Fatalf("expected plan '%s' to exist", id)
		}
		if plan.Price != 0 {
			t.Errorf("%s: expected price 0, got %d", id, plan.Price)
		}
		if plan.MaxAnalyses != 10 {
			t.Errorf("%s: expected 10 analyses, got %d", id, plan.MaxAnalyses)
		}
	}
}

func TestGetPlanProAndStarterAlias(t *testing.T) {
	for _, id := range []string{"pro", "starter"} {
		plan, ok := GetPlan(id)
		if !ok {
			t.Fatalf("expected plan '%s' to exist", id)
		}
		if plan.Price != 1900 {
			t.Errorf("%s: expected price 1900 ($19), got %d", id, plan.Price)
		}
		if plan.MaxAnalyses != 500 {
			t.Errorf("%s: expected 500 analyses, got %d", id, plan.MaxAnalyses)
		}
		if plan.MaxProviders != 10 {
			t.Errorf("%s: expected 10 providers, got %d", id, plan.MaxProviders)
		}
	}
}

func TestGetPlanTeamAndProfessionalAlias(t *testing.T) {
	for _, id := range []string{"team", "professional"} {
		plan, ok := GetPlan(id)
		if !ok {
			t.Fatalf("expected plan '%s' to exist", id)
		}
		if plan.Price != 4900 {
			t.Errorf("%s: expected price 4900 ($49), got %d", id, plan.Price)
		}
		if plan.MaxAnalyses != 2000 {
			t.Errorf("%s: expected 2000 analyses, got %d", id, plan.MaxAnalyses)
		}
		if plan.MaxProviders != 25 {
			t.Errorf("%s: expected 25 providers, got %d", id, plan.MaxProviders)
		}
	}
}

func TestGetPlanEnterpriseIsContactTier(t *testing.T) {
	for _, id := range []string{"enterprise", "enterprise_plus"} {
		plan, ok := GetPlan(id)
		if !ok {
			t.Fatalf("expected plan '%s' to exist", id)
		}
		// Enterprise is contact-sales: price intentionally 0 (not surfaced)
		if plan.MaxAnalyses != -1 {
			t.Errorf("%s: expected unlimited (-1), got %d", id, plan.MaxAnalyses)
		}
		if plan.MaxProviders != -1 {
			t.Errorf("%s: expected unlimited (-1), got %d", id, plan.MaxProviders)
		}
	}
}

func TestGetPlanNotFound(t *testing.T) {
	if _, ok := GetPlan("nonexistent"); ok {
		t.Error("expected plan not to exist")
	}
}

func TestPlanFeatures(t *testing.T) {
	plan, _ := GetPlan("pro")
	if len(plan.Features) == 0 {
		t.Fatal("expected features to be set")
	}
	joined := strings.Join(plan.Features, " | ")
	if !strings.Contains(joined, "Sonnet-tier AI") {
		t.Errorf("expected Sonnet-tier feature in Pro, got: %s", joined)
	}
}

func TestPlanCurrency(t *testing.T) {
	for _, id := range []string{"free", "pro", "team", "enterprise", "community", "starter", "professional"} {
		plan, _ := GetPlan(id)
		if plan.Currency != "usd" {
			t.Errorf("plan %s: expected currency 'usd', got %s", id, plan.Currency)
		}
	}
}

func TestAllPlansExist(t *testing.T) {
	for _, id := range []string{
		// canonical
		"free", "pro", "team", "enterprise",
		// legacy aliases for back-compat
		"community", "starter", "professional", "enterprise_plus",
	} {
		if _, ok := GetPlan(id); !ok {
			t.Errorf("expected plan '%s' to exist", id)
		}
	}
}

func TestTeamHasAuditLog(t *testing.T) {
	plan, _ := GetPlan("team")
	has := false
	for _, f := range plan.Features {
		if strings.Contains(strings.ToLower(f), "audit log") {
			has = true
		}
	}
	if !has {
		t.Error("expected team tier to include audit log")
	}
}

func TestPublicPlansAreThreePublic(t *testing.T) {
	if len(PublicPlans) != 3 {
		t.Fatalf("expected 3 public tiers, got %d", len(PublicPlans))
	}
	wantIDs := []string{"free", "pro", "team"}
	for i, want := range wantIDs {
		if PublicPlans[i].ID != want {
			t.Errorf("PublicPlans[%d]: expected ID %q, got %q", i, want, PublicPlans[i].ID)
		}
	}
}
