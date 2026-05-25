package billing

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestAllPlans(t *testing.T) {
	plans := AllPlans()
	if len(plans) < 14 {
		t.Errorf("AllPlans() count = %d, want at least 14", len(plans))
	}
}

func TestGetPlansForProduct(t *testing.T) {
	tests := []struct {
		product   domain.Product
		wantCount int
	}{
		{domain.ProductAPI, 3},
		{domain.ProductDashboard, 3},
		{domain.ProductSDK, 3},
		{domain.ProductIFrame, 3},
		{domain.ProductDataset, 3},
	}
	for _, tt := range tests {
		got := GetPlansForProduct(tt.product)
		if len(got) != tt.wantCount {
			t.Errorf("GetPlansForProduct(%s) count = %d, want %d", tt.product, len(got), tt.wantCount)
		}
	}
}

func TestGetPlanByID(t *testing.T) {
	plan, err := GetPlanByID("api_starter")
	if err != nil {
		t.Fatalf("GetPlanByID() error = %v", err)
	}
	if plan.ID != "api_starter" {
		t.Errorf("Plan ID = %s, want api_starter", plan.ID)
	}
	if plan.Product != domain.ProductAPI {
		t.Errorf("Plan Product = %v, want %v", plan.Product, domain.ProductAPI)
	}

	_, err = GetPlanByID("nonexistent")
	if err == nil {
		t.Error("GetPlanByID() should fail for nonexistent plan")
	}
}

func TestPlanLimits(t *testing.T) {
	plan, _ := GetPlanByID("api_starter")
	limit, ok := plan.GetLimit(domain.MetricAPIScreenings)
	if !ok || limit != 10000 {
		t.Errorf("API Starter limit = %d, want 10000", limit)
	}
}
