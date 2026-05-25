package billing

import (
	"testing"
)

func TestNewBillingServiceNilConfig(t *testing.T) {
	svc := NewBillingService(nil, nil, nil, nil, nil)
	if svc == nil {
		t.Fatal("NewBillingService() returned nil")
	}
	if svc.lsClient != nil {
		t.Error("lsClient should be nil when config is nil")
	}
}

func TestNewBillingServiceWithConfig(t *testing.T) {
	cfg := &LemonSqueezyConfig{APIKey: "test_key"}
	svc := NewBillingService(cfg, nil, nil, nil, nil)
	if svc == nil {
		t.Fatal("NewBillingService() returned nil")
	}
	if svc.lsClient == nil {
		t.Error("lsClient should not be nil with valid config")
	}
}

func TestNewBillingServiceEmptyAPIKey(t *testing.T) {
	cfg := &LemonSqueezyConfig{APIKey: ""}
	svc := NewBillingService(cfg, nil, nil, nil, nil)
	if svc == nil {
		t.Fatal("NewBillingService() returned nil")
	}
	if svc.lsClient != nil {
		t.Error("lsClient should be nil with empty API key")
	}
}
