package billing

import (
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestValidatePromoCode(t *testing.T) {
	promo, err := ValidatePromoCode("AEGIS_FREE", domain.ProductAPI)
	if err != nil {
		t.Fatalf("ValidatePromoCode() error = %v", err)
	}
	if promo.DiscountPercent != 100 {
		t.Errorf("Discount = %d, want 100", promo.DiscountPercent)
	}
}

func TestValidatePromoCodeInvalid(t *testing.T) {
	_, err := ValidatePromoCode("INVALID", domain.ProductAPI)
	if err == nil {
		t.Error("ValidatePromoCode() should fail for invalid code")
	}
}

func TestValidatePromoCodeExpired(t *testing.T) {
	code := domain.PromoCode{
		Code:            "EXPIRED",
		DiscountPercent: 50,
		ValidProducts:   []domain.Product{domain.ProductAPI},
	}
	past := time.Now().UTC().Add(-1 * time.Hour)
	code.ExpiresAt = &past
	RegisterPromoCode(code)

	_, err := ValidatePromoCode("EXPIRED", domain.ProductAPI)
	if err == nil {
		t.Error("ValidatePromoCode() should fail for expired code")
	}
}

func TestApplyPromoDiscount(t *testing.T) {
	tests := []struct {
		base    int
		percent int
		want    int
	}{
		{10000, 0, 10000},
		{10000, 50, 5000},
		{10000, 100, 0},
	}
	for _, tt := range tests {
		promo, _ := domain.NewPromoCode("TEST", tt.percent, 1, nil)
		got := ApplyPromoDiscount(tt.base, promo)
		if got != tt.want {
			t.Errorf("ApplyPromoDiscount(%d, %d%%) = %d, want %d", tt.base, tt.percent, got, tt.want)
		}
	}
}

func TestGetPromoCode(t *testing.T) {
	promo, err := GetPromoCode("AEGIS_FREE")
	if err != nil {
		t.Fatalf("GetPromoCode() error = %v", err)
	}
	if promo.Code != "AEGIS_FREE" {
		t.Errorf("Code = %s, want AEGIS_FREE", promo.Code)
	}
}
