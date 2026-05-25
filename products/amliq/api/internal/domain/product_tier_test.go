package domain

import "testing"

func TestNewProductTier(t *testing.T) {
	tests := []struct {
		product Product
		tier    PlanTier
		wantErr bool
	}{
		{ProductAPI, TierStarting, false},
		{ProductAPI, TierProfessional, false},
		{ProductAPI, TierEnterprise, false},
		{ProductAPI, TierBasic, true},
		{ProductDashboard, TierBasic, false},
		{ProductDashboard, TierEnterprise, false},
		{ProductDashboard, TierStarting, true},
		{Product("invalid"), TierBasic, true},
		{ProductAPI, PlanTier("invalid"), true},
	}
	for _, tt := range tests {
		_, err := NewProductTier(tt.product, string(tt.tier))
		if (err != nil) != tt.wantErr {
			t.Errorf("NewProductTier(%s, %s) error = %v, wantErr %v", tt.product, tt.tier, err, tt.wantErr)
		}
	}
}

func TestProductTierKey(t *testing.T) {
	pt, _ := NewProductTier(ProductAPI, string(TierStarting))
	want := "api:starting"
	if got := pt.Key(); got != want {
		t.Errorf("ProductTier.Key() = %v, want %v", got, want)
	}
}

func TestValidTiersFor(t *testing.T) {
	tests := []struct {
		product Product
		wantLen int
	}{
		{ProductAPI, 3},
		{ProductDashboard, 2},
		{ProductSDK, 3},
		{ProductIFrame, 3},
		{ProductDataset, 3},
	}
	for _, tt := range tests {
		got := validTiersFor(tt.product)
		if len(got) != tt.wantLen {
			t.Errorf("validTiersFor(%s) len = %d, want %d", tt.product, len(got), tt.wantLen)
		}
	}
}
