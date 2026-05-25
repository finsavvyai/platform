package billing

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

type CheckoutRequest struct {
	Product       domain.Product
	PlanID        string
	PromoCode     string
	BillingPeriod string
	SuccessURL    string
	CancelURL     string
	TenantID      string
}

func CreateCheckoutURL(cfg *LemonSqueezyConfig, req CheckoutRequest) (string, error) {
	if req.Product == "" || req.PlanID == "" {
		return "", fmt.Errorf("product and plan_id required")
	}

	plan, err := GetPlanByID(req.PlanID)
	if err != nil {
		return "", err
	}

	variantID := plan.LemonSqueezyVariantID
	if req.BillingPeriod == "annual" {
		variantID = plan.LemonSqueezyVariantIDAnnual
	}

	if variantID == "" {
		return "", fmt.Errorf("no variant ID for plan %s", req.PlanID)
	}

	checkoutURL := fmt.Sprintf("https://aegis-aml.lemonsqueezy.com/checkout/buy/%s", variantID)

	params := url.Values{}
	if req.TenantID != "" {
		params.Set("custom[tenant_id]", req.TenantID)
	}
	params.Set("custom[product]", string(req.Product))
	if req.PromoCode != "" {
		params.Set("discount_code", req.PromoCode)
	}
	if req.SuccessURL != "" {
		params.Set("success_url", req.SuccessURL)
	}
	if req.CancelURL != "" {
		params.Set("cancel_url", req.CancelURL)
	}

	if len(params) > 0 {
		checkoutURL += "?" + params.Encode()
	}
	return checkoutURL, nil
}

func ValidateCheckoutRequest(req CheckoutRequest) error {
	if !req.Product.IsValid() {
		return fmt.Errorf("invalid product: %s", req.Product)
	}
	if req.PlanID == "" {
		return fmt.Errorf("plan_id required")
	}
	if req.BillingPeriod != "" && req.BillingPeriod != "monthly" && req.BillingPeriod != "annual" {
		return fmt.Errorf("invalid billing_period: %s", req.BillingPeriod)
	}
	if req.PromoCode != "" && len(req.PromoCode) > 50 {
		return fmt.Errorf("promo code too long")
	}
	if req.SuccessURL != "" && !strings.HasPrefix(req.SuccessURL, "https://") {
		return fmt.Errorf("success_url must be https")
	}
	if req.CancelURL != "" && !strings.HasPrefix(req.CancelURL, "https://") {
		return fmt.Errorf("cancel_url must be https")
	}
	return nil
}
