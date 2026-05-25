package domain

import (
	"fmt"
	"time"
)

type PromoCode struct {
	Code               string
	DiscountPercent    int
	DurationMonths     int
	ValidProducts      []Product
	ExpiresAt          *time.Time
	MaxRedemptions     int
	CurrentRedemptions int
}

const (
	FreePromoCode = "AEGIS_FREE"
	FreeDiscount  = 100
	FreeForever   = 0
)

func NewPromoCode(code string, discountPercent, durationMonths int, products []Product) (PromoCode, error) {
	if code == "" || discountPercent < 0 || discountPercent > 100 {
		return PromoCode{}, fmt.Errorf("invalid promo code parameters")
	}
	if len(products) == 0 {
		products = AllProducts()
	}
	return PromoCode{
		Code:            code,
		DiscountPercent: discountPercent,
		DurationMonths:  durationMonths,
		ValidProducts:   products,
		MaxRedemptions:  0,
	}, nil
}

func (pc PromoCode) IsExpired() bool {
	if pc.ExpiresAt == nil {
		return false
	}
	return time.Now().UTC().After(*pc.ExpiresAt)
}

func (pc PromoCode) IsRedeemable() bool {
	if pc.IsExpired() {
		return false
	}
	if pc.MaxRedemptions > 0 && pc.CurrentRedemptions >= pc.MaxRedemptions {
		return false
	}
	return true
}

func (pc PromoCode) IsValidForProduct(p Product) bool {
	for _, prod := range pc.ValidProducts {
		if prod == p {
			return true
		}
	}
	return false
}

func (pc *PromoCode) Redeem() error {
	if !pc.IsRedeemable() {
		return fmt.Errorf("promo code not redeemable")
	}
	pc.CurrentRedemptions++
	return nil
}

func AEGISFreePromo() PromoCode {
	return PromoCode{
		Code:               FreePromoCode,
		DiscountPercent:    FreeDiscount,
		DurationMonths:     FreeForever,
		ValidProducts:      AllProducts(),
		MaxRedemptions:     0,
		CurrentRedemptions: 0,
	}
}
