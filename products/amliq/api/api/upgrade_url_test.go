package api

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUpgradeCheckoutURLDefault(t *testing.T) {
	t.Setenv("UPGRADE_CHECKOUT_URL", "")
	got := UpgradeCheckoutURL()
	if got != DefaultUpgradeCheckoutURL {
		t.Errorf("got %q, want %q", got, DefaultUpgradeCheckoutURL)
	}
}

func TestUpgradeCheckoutURLEnvOverride(t *testing.T) {
	t.Setenv("UPGRADE_CHECKOUT_URL", "https://staging/checkout")
	if UpgradeCheckoutURL() != "https://staging/checkout" {
		t.Errorf("env override ignored")
	}
}

func TestPaywallErrorEmitsUpgradeURL(t *testing.T) {
	t.Setenv("UPGRADE_CHECKOUT_URL", "https://amliq.test/buy")
	rr := httptest.NewRecorder()
	PaywallError(rr, "FREE_TIER_EXHAUSTED", "limit reached")

	if rr.Code != 402 {
		t.Fatalf("status=%d, want 402", rr.Code)
	}
	if !strings.Contains(rr.Body.String(), "upgrade_url") {
		t.Errorf("body missing upgrade_url: %s", rr.Body.String())
	}
	var resp ErrorResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.UpgradeURL != "https://amliq.test/buy" {
		t.Errorf("upgrade_url=%q, want override", resp.UpgradeURL)
	}
	if resp.Code != "FREE_TIER_EXHAUSTED" {
		t.Errorf("code=%q", resp.Code)
	}
}
