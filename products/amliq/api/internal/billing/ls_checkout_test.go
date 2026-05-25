package billing

import (
	"strings"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestCreateCheckoutURL(t *testing.T) {
	cfg := &LemonSqueezyConfig{
		StoreID: "test",
	}

	plan, _ := GetPlanByID("api_starter")
	plan.SetLemonSqueezyVariant("var_123", "var_annual")

	plan.ID = "test_plan"
	origPlans := allPlans
	allPlans = append(allPlans, plan)
	t.Cleanup(func() { allPlans = origPlans })

	req := CheckoutRequest{
		Product:    domain.ProductAPI,
		PlanID:     "test_plan",
		PromoCode:  "SAVE10",
		TenantID:   "tenant_123",
		SuccessURL: "https://example.com/success",
	}

	url, err := CreateCheckoutURL(cfg, req)
	if err != nil {
		t.Fatalf("CreateCheckoutURL() error = %v", err)
	}
	if !strings.HasPrefix(url, "https://aegis-aml.lemonsqueezy.com") {
		t.Errorf("URL = %s, want lemonsqueezy domain", url)
	}
	if !strings.Contains(url, "custom%5Btenant_id%5D=tenant_123") {
		t.Error("URL missing tenant_id")
	}
}

func TestValidateCheckoutRequest(t *testing.T) {
	tests := []struct {
		name    string
		req     CheckoutRequest
		wantErr bool
	}{
		{"valid", CheckoutRequest{Product: domain.ProductAPI, PlanID: "p1"}, false},
		{"invalid product", CheckoutRequest{Product: domain.Product("invalid"), PlanID: "p1"}, true},
		{"missing plan", CheckoutRequest{Product: domain.ProductAPI, PlanID: ""}, true},
		{"invalid period", CheckoutRequest{Product: domain.ProductAPI, PlanID: "p1", BillingPeriod: "invalid"}, true},
		{"http url", CheckoutRequest{Product: domain.ProductAPI, PlanID: "p1", SuccessURL: "http://example.com"}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCheckoutRequest(tt.req)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCheckoutRequest() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
