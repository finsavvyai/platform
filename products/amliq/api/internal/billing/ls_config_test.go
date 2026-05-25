package billing

import (
	"os"
	"testing"
)

func TestLoadLemonSqueezyConfig(t *testing.T) {
	os.Setenv("LS_STORE_ID", "test_store")
	os.Setenv("LS_API_KEY", "test_key")
	os.Setenv("LS_WEBHOOK_SECRET", "test_secret")
	defer func() {
		os.Unsetenv("LS_STORE_ID")
		os.Unsetenv("LS_API_KEY")
		os.Unsetenv("LS_WEBHOOK_SECRET")
	}()

	cfg, err := LoadLemonSqueezyConfig()
	if err != nil {
		t.Fatalf("LoadLemonSqueezyConfig() error = %v", err)
	}
	if cfg.StoreID != "test_store" {
		t.Errorf("StoreID = %s, want test_store", cfg.StoreID)
	}
}

func TestLoadLemonSqueezyConfigMissing(t *testing.T) {
	os.Unsetenv("LS_STORE_ID")
	os.Unsetenv("LS_API_KEY")
	os.Unsetenv("LS_WEBHOOK_SECRET")

	_, err := LoadLemonSqueezyConfig()
	if err == nil {
		t.Error("LoadLemonSqueezyConfig() should fail with missing config")
	}
}

func TestGetProductID(t *testing.T) {
	cfg := &LemonSqueezyConfig{
		ProductIDs: map[string]string{
			"api": "prod_123",
		},
	}
	id, err := cfg.GetProductID("api")
	if err != nil {
		t.Errorf("GetProductID() error = %v", err)
	}
	if id != "prod_123" {
		t.Errorf("GetProductID() = %s, want prod_123", id)
	}

	_, err = cfg.GetProductID("invalid")
	if err == nil {
		t.Error("GetProductID() should fail for invalid product")
	}
}

func TestGetVariantID(t *testing.T) {
	cfg := &LemonSqueezyConfig{
		VariantIDs: map[string]string{
			"plan_starter": "var_456",
		},
	}
	id, err := cfg.GetVariantID("plan_starter")
	if err != nil {
		t.Errorf("GetVariantID() error = %v", err)
	}
	if id != "var_456" {
		t.Errorf("GetVariantID() = %s, want var_456", id)
	}
}
