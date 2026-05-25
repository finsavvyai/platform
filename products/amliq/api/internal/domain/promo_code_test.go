package domain

import (
	"testing"
	"time"
)

func TestNewPromoCode(t *testing.T) {
	tests := []struct {
		code    string
		percent int
		months  int
		wantErr bool
	}{
		{"SAVE10", 10, 1, false},
		{"SAVE100", 100, 0, false},
		{"", 10, 1, true},
		{"INVALID", 101, 1, true},
	}
	for _, tt := range tests {
		_, err := NewPromoCode(tt.code, tt.percent, tt.months, nil)
		if (err != nil) != tt.wantErr {
			t.Errorf("NewPromoCode() error = %v, wantErr %v", err, tt.wantErr)
		}
	}
}

func TestPromoCodeIsExpired(t *testing.T) {
	pc := AEGISFreePromo()
	if pc.IsExpired() {
		t.Error("free promo should not expire")
	}

	past := time.Now().UTC().Add(-1 * time.Hour)
	pc.ExpiresAt = &past
	if !pc.IsExpired() {
		t.Error("past expiry should be expired")
	}
}

func TestPromoCodeIsRedeemable(t *testing.T) {
	pc := AEGISFreePromo()
	if !pc.IsRedeemable() {
		t.Error("free promo should be redeemable")
	}

	past := time.Now().UTC().Add(-1 * time.Hour)
	pc.ExpiresAt = &past
	if pc.IsRedeemable() {
		t.Error("expired promo should not be redeemable")
	}

	pc2, _ := NewPromoCode("LIMITED", 50, 1, nil)
	pc2.MaxRedemptions = 1
	pc2.CurrentRedemptions = 1
	if pc2.IsRedeemable() {
		t.Error("max redemptions reached should not be redeemable")
	}
}

func TestIsValidForProduct(t *testing.T) {
	pc := AEGISFreePromo()
	if !pc.IsValidForProduct(ProductAPI) {
		t.Error("free promo should be valid for all products")
	}

	pc2, _ := NewPromoCode("API_ONLY", 50, 1, []Product{ProductAPI})
	if !pc2.IsValidForProduct(ProductAPI) {
		t.Error("API_ONLY should be valid for ProductAPI")
	}
	if pc2.IsValidForProduct(ProductDashboard) {
		t.Error("API_ONLY should not be valid for ProductDashboard")
	}
}

func TestPromoCodeRedeem(t *testing.T) {
	pc, _ := NewPromoCode("TESTCODE", 25, 1, nil)
	pc.MaxRedemptions = 2
	if err := pc.Redeem(); err != nil {
		t.Errorf("Redeem() error = %v", err)
	}
	if pc.CurrentRedemptions != 1 {
		t.Errorf("CurrentRedemptions = %d, want 1", pc.CurrentRedemptions)
	}
	pc.Redeem()
	if err := pc.Redeem(); err == nil {
		t.Error("Redeem() should fail at max")
	}
}
