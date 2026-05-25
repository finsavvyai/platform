package domain

import "testing"

func TestNewPlan(t *testing.T) {
	tests := []struct {
		id      string
		product Product
		tier    string
		name    string
		price   int
		wantErr bool
	}{
		{"p1", ProductAPI, "starter", "API Starter", 49900, false},
		{"", ProductAPI, "starter", "API Starter", 49900, true},
		{"p1", Product("invalid"), "starter", "API Starter", 49900, true},
		{"p1", ProductAPI, "starter", "", 49900, true},
	}
	for _, tt := range tests {
		_, err := NewPlan(tt.id, tt.product, tt.tier, tt.name, tt.price)
		if (err != nil) != tt.wantErr {
			t.Errorf("NewPlan() error = %v, wantErr %v", err, tt.wantErr)
		}
	}
}

func TestPlanMonthlyPrice(t *testing.T) {
	plan, _ := NewPlan("p1", ProductAPI, "starter", "API Starter", 49900)
	if got := plan.MonthlyPriceUSD(); got != 499.0 {
		t.Errorf("MonthlyPriceUSD() = %v, want 499.0", got)
	}
}

func TestSetLemonSqueezyVariant(t *testing.T) {
	plan, _ := NewPlan("p1", ProductAPI, "starter", "API Starter", 49900)
	plan.SetLemonSqueezyVariant("var123", "var456")
	if plan.LemonSqueezyVariantID != "var123" {
		t.Errorf("LemonSqueezyVariantID = %s, want var123", plan.LemonSqueezyVariantID)
	}
}

func TestGetSetLimit(t *testing.T) {
	plan, _ := NewPlan("p1", ProductAPI, "starter", "API Starter", 49900)
	plan.SetLimit(MetricAPIScreenings, 10000)
	limit, ok := plan.GetLimit(MetricAPIScreenings)
	if !ok || limit != 10000 {
		t.Errorf("GetLimit() = %d, %v, want 10000, true", limit, ok)
	}
	_, ok = plan.GetLimit(MetricDashboardSeats)
	if ok {
		t.Error("GetLimit() should return false for unset metric")
	}
}
