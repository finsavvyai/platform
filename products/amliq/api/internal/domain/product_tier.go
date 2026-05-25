package domain

import "fmt"

type ProductTier struct {
	Product Product
	Tier    string
}

// Tier constants are defined in plan_tier.go as PlanTier type.

func NewProductTier(product Product, tier string) (ProductTier, error) {
	if !product.IsValid() {
		return ProductTier{}, fmt.Errorf("invalid product: %s", product)
	}
	pt := PlanTier(tier)
	if !pt.IsValid() {
		return ProductTier{}, fmt.Errorf("invalid tier: %s", tier)
	}
	validTiersForProduct := validTiersFor(product)
	isValid := false
	for _, t := range validTiersForProduct {
		if t == tier {
			isValid = true
			break
		}
	}
	if !isValid {
		return ProductTier{}, fmt.Errorf("tier %s not valid for product %s", tier, product)
	}
	return ProductTier{Product: product, Tier: tier}, nil
}

func (pt ProductTier) Key() string {
	return fmt.Sprintf("%s:%s", pt.Product, pt.Tier)
}

func validTiersFor(p Product) []string {
	switch p {
	case ProductAPI:
		return []string{"starting", "professional", "enterprise"}
	case ProductDashboard:
		return []string{"basic", "enterprise"}
	case ProductSDK:
		return []string{"starting", "professional", "enterprise"}
	case ProductIFrame:
		return []string{"basic", "professional", "enterprise"}
	case ProductDataset:
		return []string{"standard", "premium", "enterprise"}
	}
	return []string{}
}
