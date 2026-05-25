package api

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

func TestValidateCheckoutRequest(t *testing.T) {
	tests := []struct {
		name    string
		req     billing.CheckoutRequest
		wantErr bool
	}{
		{
			"valid monthly",
			billing.CheckoutRequest{
				Product:       domain.ProductAPI,
				PlanID:        "api_starter",
				BillingPeriod: "monthly",
			},
			false,
		},
		{
			"valid annual",
			billing.CheckoutRequest{
				Product:       domain.ProductDashboard,
				PlanID:        "dash_base",
				BillingPeriod: "annual",
			},
			false,
		},
		{
			"missing product",
			billing.CheckoutRequest{PlanID: "api_starter"},
			true,
		},
		{
			"missing plan_id",
			billing.CheckoutRequest{Product: domain.ProductAPI},
			true,
		},
		{
			"invalid billing_period",
			billing.CheckoutRequest{
				Product:       domain.ProductAPI,
				PlanID:        "api_starter",
				BillingPeriod: "weekly",
			},
			true,
		},
		{
			"non-https success_url",
			billing.CheckoutRequest{
				Product:    domain.ProductAPI,
				PlanID:     "api_starter",
				SuccessURL: "http://example.com",
			},
			true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := billing.ValidateCheckoutRequest(tt.req)
			if (err != nil) != tt.wantErr {
				t.Errorf("got err=%v, wantErr=%v", err, tt.wantErr)
			}
		})
	}
}
