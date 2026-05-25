package domain

import (
	"testing"
	"time"
)

func TestNewAPICredential(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		product  Product
		wantErr  bool
	}{
		{"valid api", "t1", ProductAPI, false},
		{"valid sdk", "t1", ProductSDK, false},
		{"empty tenant", "", ProductAPI, true},
		{"invalid product", "t1", Product("invalid"), true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewAPICredential(tt.tenantID, tt.product, []string{})
			if (err != nil) != tt.wantErr {
				t.Errorf("NewAPICredential() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestPrefixForProduct(t *testing.T) {
	tests := []struct {
		product Product
		want    string
	}{
		{ProductAPI, "aegis_api_sk_"},
		{ProductSDK, "aegis_sdk_sk_"},
		{ProductIFrame, "aegis_iframe_pk_"},
		{ProductDataset, "aegis_csv_sk_"},
		{ProductDashboard, "aegis_dash_sk_"},
	}
	for _, tt := range tests {
		if got := prefixForProduct(tt.product); got != tt.want {
			t.Errorf("prefixForProduct(%s) = %v, want %v", tt.product, got, tt.want)
		}
	}
}

func TestAPICredentialIsExpired(t *testing.T) {
	ac, _ := NewAPICredential("t1", ProductAPI, []string{})
	if ac.IsExpired() {
		t.Error("non-expiring credential should not be expired")
	}

	past := time.Now().UTC().Add(-1 * time.Hour)
	ac.ExpiresAt = &past
	if !ac.IsExpired() {
		t.Error("past expiry should be expired")
	}

	future := time.Now().UTC().Add(1 * time.Hour)
	ac.ExpiresAt = &future
	if ac.IsExpired() {
		t.Error("future expiry should not be expired")
	}
}

func TestHasScope(t *testing.T) {
	ac, _ := NewAPICredential("t1", ProductAPI, []string{"read", "write"})
	if !ac.HasScope("read") {
		t.Error("HasScope(read) should be true")
	}
	if ac.HasScope("delete") {
		t.Error("HasScope(delete) should be false")
	}
}
