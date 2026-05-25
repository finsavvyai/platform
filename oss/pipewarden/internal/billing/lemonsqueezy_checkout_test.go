package billing

import (
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Enabled
// ---------------------------------------------------------------------------

// TestEnabled_WithAPIKey verifies that a client configured with only an API
// key reports itself as enabled.
func TestEnabled_WithAPIKey(t *testing.T) {
	client := New(LemonSqueezyConfig{APIKey: "sk-test"})
	if !client.Enabled() {
		t.Error("expected Enabled()=true when APIKey is set")
	}
}

// TestEnabled_WithWebhookKey verifies that a client configured with only a
// webhook key (no API key) still reports itself as enabled.
func TestEnabled_WithWebhookKey(t *testing.T) {
	client := New(LemonSqueezyConfig{WebhookKey: "wh-secret"})
	if !client.Enabled() {
		t.Error("expected Enabled()=true when WebhookKey is set")
	}
}

// TestEnabled_NoCredentials verifies that a client with no credentials at all
// reports itself as disabled.
func TestEnabled_NoCredentials(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	if client.Enabled() {
		t.Error("expected Enabled()=false when no credentials are configured")
	}
}

// TestEnabled_BothKeys verifies that setting both keys also returns true.
func TestEnabled_BothKeys(t *testing.T) {
	client := New(LemonSqueezyConfig{APIKey: "key", WebhookKey: "secret"})
	if !client.Enabled() {
		t.Error("expected Enabled()=true when both APIKey and WebhookKey are set")
	}
}

// ---------------------------------------------------------------------------
// CheckSubscription / GetSubscriptionStatus — happy paths
// ---------------------------------------------------------------------------

// TestCheckSubscription_ValidTenantID verifies that a non-empty tenant returns
// nil error and nil subscription (stub implementation).
func TestCheckSubscription_ValidTenantID(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	sub, err := client.CheckSubscription("tenant-abc")
	if err != nil {
		t.Errorf("unexpected error for valid tenant_id: %v", err)
	}
	// The current stub returns (nil, nil) for valid tenant IDs.
	if sub != nil {
		t.Errorf("expected nil subscription from stub, got %+v", sub)
	}
}

// TestGetSubscriptionStatus_ValidTenantID verifies that a non-empty tenant
// returns TierCommunity and no error (stub implementation).
func TestGetSubscriptionStatus_ValidTenantID(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	tier, err := client.GetSubscriptionStatus("tenant-abc")
	if err != nil {
		t.Errorf("unexpected error for valid tenant_id: %v", err)
	}
	if tier != TierCommunity {
		t.Errorf("expected TierCommunity from stub, got %s", tier)
	}
}

// ---------------------------------------------------------------------------
// CreateCheckoutURL — missing tier branches
// ---------------------------------------------------------------------------

// TestCreateCheckoutURL_Team covers the TierTeam branch that was missing.
func TestCreateCheckoutURL_Team(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	url, err := client.CreateCheckoutURL("tenant-1", string(TierTeam), "dev@example.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url == "" {
		t.Error("expected non-empty URL for team tier")
	}
	if !strings.Contains(url, "team-monthly") {
		t.Errorf("expected 'team-monthly' variant in URL, got: %s", url)
	}
	if !strings.Contains(url, "tenant-1") {
		t.Error("expected tenant_id in checkout URL")
	}
	if !strings.Contains(url, "dev%40example.com") || !strings.Contains(url, "dev@example.com") {
		// The URL may or may not URL-encode @ in fmt.Sprintf; accept either form.
		if !strings.Contains(url, "dev") {
			t.Error("expected email address in checkout URL")
		}
	}
}

// TestCreateCheckoutURL_Professional verifies the professional variant slug.
func TestCreateCheckoutURL_Professional(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	url, err := client.CreateCheckoutURL("t1", string(TierProfessional), "a@b.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(url, "professional-monthly") {
		t.Errorf("expected 'professional-monthly' in URL, got: %s", url)
	}
}

// TestCreateCheckoutURL_Enterprise verifies the enterprise variant slug.
func TestCreateCheckoutURL_Enterprise(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	url, err := client.CreateCheckoutURL("t1", string(TierEnterprise), "a@b.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(url, "enterprise-monthly") {
		t.Errorf("expected 'enterprise-monthly' in URL, got: %s", url)
	}
}

// TestCreateCheckoutURL_EnterpriseP verifies the enterprise_plus variant slug.
func TestCreateCheckoutURL_EnterpriseP(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	url, err := client.CreateCheckoutURL("t1", string(TierEnterpriseP), "a@b.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(url, "enterprise-plus-custom") {
		t.Errorf("expected 'enterprise-plus-custom' in URL, got: %s", url)
	}
}

// TestCreateCheckoutURL_Starter verifies the starter variant slug and URL structure.
func TestCreateCheckoutURL_StarterURLStructure(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	url, err := client.CreateCheckoutURL("my-tenant", string(TierStarter), "user@test.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(url, "https://checkout.lemonsqueezy.com/checkout/buy/") {
		t.Errorf("expected LemonSqueezy checkout URL prefix, got: %s", url)
	}
	if !strings.Contains(url, "starter-monthly") {
		t.Errorf("expected 'starter-monthly' variant, got: %s", url)
	}
	if !strings.Contains(url, "my-tenant") {
		t.Error("expected tenant_id in URL")
	}
}

// TestCreateCheckoutURL_Community verifies that the community (free) tier
// returns an error since it has no checkout variant.
func TestCreateCheckoutURL_Community(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	url, err := client.CreateCheckoutURL("t1", string(TierCommunity), "a@b.com")
	if err == nil {
		t.Error("expected error for community tier (no checkout)")
	}
	if url != "" {
		t.Error("expected empty URL for community tier")
	}
}

// ---------------------------------------------------------------------------
// EnforceConnectionLimit — unlimited tier path
// ---------------------------------------------------------------------------

// TestEnforceConnectionLimit_UnlimitedTier verifies that an enterprise tier
// with many connections never reports exceeded.
func TestEnforceConnectionLimit_UnlimitedTier(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	exceeded, limit, err := client.EnforceConnectionLimit("tenant-x", TierEnterprise, 9999)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exceeded {
		t.Error("expected no limit exceeded for enterprise unlimited tier")
	}
	if limit != -1 {
		t.Errorf("expected limit=-1 (unlimited) for enterprise tier, got %d", limit)
	}
}

// TestEnforceConnectionLimit_EnterprisePUnlimited verifies enterprise_plus also
// has no connection ceiling.
func TestEnforceConnectionLimit_EnterprisePUnlimited(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	exceeded, limit, err := client.EnforceConnectionLimit("tenant-x", TierEnterpriseP, 10000)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exceeded {
		t.Error("expected no limit exceeded for enterprise_plus tier")
	}
	if limit != -1 {
		t.Errorf("expected limit=-1, got %d", limit)
	}
}

// TestEnforceConnectionLimit_ExactlyAtLimit verifies the boundary condition
// where currentCount equals MaxConnections (should be exceeded).
func TestEnforceConnectionLimit_ExactlyAtLimit(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	// TierStarter allows 5 connections; currentCount=5 should be exceeded.
	exceeded, limit, err := client.EnforceConnectionLimit("t", TierStarter, 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !exceeded {
		t.Error("expected exceeded=true when currentCount equals MaxConnections")
	}
	if limit != 5 {
		t.Errorf("expected limit=5, got %d", limit)
	}
}

// TestEnforceConnectionLimit_OneBelowLimit verifies the boundary condition
// where currentCount is one less than MaxConnections (should not be exceeded).
func TestEnforceConnectionLimit_OneBelowLimit(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	// TierStarter allows 5; currentCount=4 should not be exceeded.
	exceeded, limit, err := client.EnforceConnectionLimit("t", TierStarter, 4)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exceeded {
		t.Error("expected exceeded=false when currentCount is below MaxConnections")
	}
	if limit != 5 {
		t.Errorf("expected limit=5, got %d", limit)
	}
}
