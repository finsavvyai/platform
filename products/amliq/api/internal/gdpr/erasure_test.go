package gdpr

import (
	"context"
	"testing"
)

func TestEraseRequiresTenantID(t *testing.T) {
	_, err := EraseCustomerData(context.Background(), nil, "", "cust1")
	if err == nil || err.Error() != "tenant_id required for erasure" {
		t.Fatalf("want tenant_id required, got %v", err)
	}
}

func TestEraseRequiresCustomerID(t *testing.T) {
	_, err := EraseCustomerData(context.Background(), nil, "tnt_x", "")
	if err == nil || err.Error() != "customer_id required for erasure" {
		t.Fatalf("want customer_id required, got %v", err)
	}
}
