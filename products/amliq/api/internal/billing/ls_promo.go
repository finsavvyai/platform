package billing

import (
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

var promoDatabase = make(map[string]domain.PromoCode)

func init() {
	promoDatabase[domain.FreePromoCode] = domain.AEGISFreePromo()
}

func RegisterPromoCode(code domain.PromoCode) error {
	if code.Code == "" {
		return fmt.Errorf("promo code cannot be empty")
	}
	promoDatabase[code.Code] = code
	return nil
}

func ValidatePromoCode(code string, product domain.Product) (domain.PromoCode, error) {
	if code == "" {
		return domain.PromoCode{}, fmt.Errorf("promo code required")
	}

	promo, ok := promoDatabase[code]
	if !ok {
		return domain.PromoCode{}, fmt.Errorf("promo code not found: %s", code)
	}

	if !promo.IsRedeemable() {
		return domain.PromoCode{}, fmt.Errorf("promo code not redeemable: %s", code)
	}

	if !promo.IsValidForProduct(product) {
		return domain.PromoCode{}, fmt.Errorf("promo code not valid for product: %s", product)
	}

	return promo, nil
}

func GetPromoCode(code string) (domain.PromoCode, error) {
	promo, ok := promoDatabase[code]
	if !ok {
		return domain.PromoCode{}, fmt.Errorf("promo code not found: %s", code)
	}
	return promo, nil
}

func ApplyPromoDiscount(basePriceCents int, promo domain.PromoCode) int {
	discountAmount := (basePriceCents * promo.DiscountPercent) / 100
	return basePriceCents - discountAmount
}
