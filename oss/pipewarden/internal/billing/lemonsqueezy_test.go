package billing

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGetTierLimits_Community(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	limits := client.GetTierLimits(TierCommunity)

	if limits.Tier != TierCommunity {
		t.Errorf("expected tier %s, got %s", TierCommunity, limits.Tier)
	}
	if limits.MaxConnections != 1 {
		t.Errorf("expected MaxConnections=1, got %d", limits.MaxConnections)
	}
	if limits.MaxScansPerDay != 10 {
		t.Errorf("expected MaxScansPerDay=10, got %d", limits.MaxScansPerDay)
	}
	if limits.AIAnalysisEnabled {
		t.Error("expected AIAnalysisEnabled=false for community tier")
	}
	if limits.SIEMIntegration {
		t.Error("expected SIEMIntegration=false for community tier")
	}
}

func TestGetTierLimits_Starter(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	limits := client.GetTierLimits(TierStarter)

	if limits.Tier != TierStarter {
		t.Errorf("expected tier %s, got %s", TierStarter, limits.Tier)
	}
	if limits.MaxConnections != 5 {
		t.Errorf("expected MaxConnections=5, got %d", limits.MaxConnections)
	}
	if limits.MaxScansPerDay != 200 {
		t.Errorf("expected MaxScansPerDay=200, got %d", limits.MaxScansPerDay)
	}
	if !limits.AIAnalysisEnabled {
		t.Error("expected AIAnalysisEnabled=true for starter tier")
	}
	if !limits.SARIFExport {
		t.Error("expected SARIFExport=true for starter tier")
	}
	if !limits.APIAccess {
		t.Error("expected APIAccess=true for starter tier")
	}
	if limits.SSOEnabled {
		t.Error("expected SSOEnabled=false for starter tier")
	}
	if limits.ComplianceReports {
		t.Error("expected ComplianceReports=false for starter tier")
	}
}

func TestGetTierLimits_Professional(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	limits := client.GetTierLimits(TierProfessional)

	if limits.Tier != TierProfessional {
		t.Errorf("expected tier %s, got %s", TierProfessional, limits.Tier)
	}
	if limits.MaxConnections != 25 {
		t.Errorf("expected MaxConnections=25, got %d", limits.MaxConnections)
	}
	if limits.MaxScansPerDay != 1000 {
		t.Errorf("expected MaxScansPerDay=1000, got %d", limits.MaxScansPerDay)
	}
	if !limits.AIAnalysisEnabled {
		t.Error("expected AIAnalysisEnabled=true for professional tier")
	}
	if !limits.ComplianceReports {
		t.Error("expected ComplianceReports=true for professional tier")
	}
	if !limits.CustomOPAPolicies {
		t.Error("expected CustomOPAPolicies=true for professional tier")
	}
	if !limits.SIEMIntegration {
		t.Error("expected SIEMIntegration=true for professional tier")
	}
	if limits.SSOEnabled {
		t.Error("expected SSOEnabled=false for professional tier")
	}
	if limits.AuditRetentionDays != 90 {
		t.Errorf("expected AuditRetentionDays=90, got %d", limits.AuditRetentionDays)
	}
}

func TestGetTierLimits_Enterprise(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	limits := client.GetTierLimits(TierEnterprise)

	if limits.Tier != TierEnterprise {
		t.Errorf("expected tier %s, got %s", TierEnterprise, limits.Tier)
	}
	if limits.MaxConnections != -1 {
		t.Errorf("expected MaxConnections=-1 (unlimited), got %d", limits.MaxConnections)
	}
	if limits.MaxScansPerDay != -1 {
		t.Errorf("expected MaxScansPerDay=-1 (unlimited), got %d", limits.MaxScansPerDay)
	}
	if !limits.AIAnalysisEnabled || !limits.SARIFExport || !limits.SSOEnabled || !limits.AuditLog {
		t.Error("expected all core features enabled for enterprise tier")
	}
	if !limits.AutoFixPRs {
		t.Error("expected AutoFixPRs=true for enterprise tier")
	}
	if !limits.SIEMIntegration {
		t.Error("expected SIEMIntegration=true for enterprise tier")
	}
	if limits.AuditRetentionDays != 365 {
		t.Errorf("expected AuditRetentionDays=365, got %d", limits.AuditRetentionDays)
	}
	if limits.MaxTeamMembers != 25 {
		t.Errorf("expected MaxTeamMembers=25, got %d", limits.MaxTeamMembers)
	}
}

func TestGetTierLimits_EnterpriseP(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	limits := client.GetTierLimits(TierEnterpriseP)

	if limits.Tier != TierEnterpriseP {
		t.Errorf("expected tier %s, got %s", TierEnterpriseP, limits.Tier)
	}
	if !limits.OnPremDeployment {
		t.Error("expected OnPremDeployment=true for enterprise_plus tier")
	}
	if limits.MaxConnections != -1 || limits.MaxScansPerDay != -1 {
		t.Error("expected unlimited connections and scans for enterprise_plus tier")
	}
	if limits.AuditRetentionDays != -1 {
		t.Error("expected unlimited retention (-1) for enterprise_plus tier")
	}
	if limits.MaxTeamMembers != -1 {
		t.Error("expected unlimited team members (-1) for enterprise_plus tier")
	}
}

func TestEnforceRateLimit_Unlimited(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	exceeded, limit, err := client.EnforceRateLimit("tenant123", TierEnterprise)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exceeded {
		t.Error("expected no rate limit exceeded for enterprise tier")
	}
	if limit != -1 {
		t.Errorf("expected unlimited limit (-1), got %d", limit)
	}
}

func TestEnforceRateLimit_Limited(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	exceeded, limit, err := client.EnforceRateLimit("tenant123", TierCommunity)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exceeded {
		t.Error("expected no rate limit exceeded initially")
	}
	if limit != 10 {
		t.Errorf("expected limit=10 for community tier, got %d", limit)
	}
}

func TestEnforceConnectionLimit_Exceeded(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	exceeded, limit, err := client.EnforceConnectionLimit("tenant123", TierCommunity, 1)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !exceeded {
		t.Error("expected connection limit to be exceeded")
	}
	if limit != 1 {
		t.Errorf("expected limit=1 for community tier, got %d", limit)
	}
}

func TestEnforceConnectionLimit_NotExceeded(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	exceeded, limit, err := client.EnforceConnectionLimit("tenant123", TierStarter, 3)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if exceeded {
		t.Error("expected connection limit not to be exceeded")
	}
	if limit != 5 {
		t.Errorf("expected limit=5 for starter tier, got %d", limit)
	}
}

func TestCreateCheckoutURL_Starter(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	url, err := client.CreateCheckoutURL("tenant123", string(TierStarter), "user@example.com")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url == "" {
		t.Error("expected non-empty checkout URL")
	}
	if !bytes.Contains([]byte(url), []byte("tenant123")) {
		t.Error("expected tenant_id in checkout URL")
	}
}

func TestCreateCheckoutURL_InvalidTier(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	url, err := client.CreateCheckoutURL("tenant123", "invalid", "user@example.com")

	if err == nil {
		t.Error("expected error for invalid tier")
	}
	if url != "" {
		t.Error("expected empty URL for invalid tier")
	}
}

func TestCreateCheckoutURL_AllPaidTiers(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	tiers := []Tier{TierStarter, TierProfessional, TierEnterprise, TierEnterpriseP}

	for _, tier := range tiers {
		url, err := client.CreateCheckoutURL("tenant123", string(tier), "user@example.com")
		if err != nil {
			t.Errorf("tier %s: unexpected error: %v", tier, err)
		}
		if url == "" {
			t.Errorf("tier %s: expected non-empty checkout URL", tier)
		}
	}
}

func TestVerifyWebhookSignature_Valid(t *testing.T) {
	secret := "test-webhook-secret"
	client := New(LemonSqueezyConfig{WebhookKey: secret})

	body := []byte(`{"meta":{"event_name":"subscription_created"}}`)
	hash := hmac.New(sha256.New, []byte(secret))
	hash.Write(body)
	signature := "sha256=" + hex.EncodeToString(hash.Sum(nil))

	valid := client.VerifyWebhookSignature(body, signature)
	if !valid {
		t.Error("expected valid signature verification")
	}
}

func TestVerifyWebhookSignature_Invalid(t *testing.T) {
	secret := "test-webhook-secret"
	client := New(LemonSqueezyConfig{WebhookKey: secret})

	body := []byte(`{"meta":{"event_name":"subscription_created"}}`)
	invalidSignature := "sha256=invalid"

	valid := client.VerifyWebhookSignature(body, invalidSignature)
	if valid {
		t.Error("expected invalid signature verification to fail")
	}
}

func TestWebhookHandler_InvalidMethod(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	req := httptest.NewRequest(http.MethodGet, "/webhook", nil)
	w := httptest.NewRecorder()

	err := client.WebhookHandler(w, req)
	if err == nil {
		t.Error("expected error for invalid HTTP method")
	}
}

func TestCheckSubscription_EmptyTenantID(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	sub, err := client.CheckSubscription("")

	if err == nil {
		t.Error("expected error for empty tenant_id")
	}
	if sub != nil {
		t.Error("expected nil subscription for empty tenant_id")
	}
}

func TestGetSubscriptionStatus_EmptyTenantID(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	tier, err := client.GetSubscriptionStatus("")

	if err == nil {
		t.Error("expected error for empty tenant_id")
	}
	if tier != TierCommunity {
		t.Errorf("expected TierCommunity default, got %s", tier)
	}
}

func TestNew_CreatesClientWithConfig(t *testing.T) {
	config := LemonSqueezyConfig{
		APIKey:     "test-key",
		StoreID:    "12345",
		WebhookKey: "test-webhook-key",
	}
	client := New(config)

	if client == nil {
		t.Fatal("expected non-nil client")
	}
	if client.config.APIKey != "test-key" {
		t.Errorf("expected APIKey='test-key', got '%s'", client.config.APIKey)
	}
	if client.config.StoreID != "12345" {
		t.Errorf("expected StoreID='12345', got '%s'", client.config.StoreID)
	}
	if client.http == nil {
		t.Error("expected http client to be initialized")
	}
}

func TestTierConstants(t *testing.T) {
	if TierCommunity != "community" {
		t.Errorf("expected TierCommunity='community', got '%s'", TierCommunity)
	}
	if TierStarter != "starter" {
		t.Errorf("expected TierStarter='starter', got '%s'", TierStarter)
	}
	if TierProfessional != "professional" {
		t.Errorf("expected TierProfessional='professional', got '%s'", TierProfessional)
	}
	if TierEnterprise != "enterprise" {
		t.Errorf("expected TierEnterprise='enterprise', got '%s'", TierEnterprise)
	}
	if TierEnterpriseP != "enterprise_plus" {
		t.Errorf("expected TierEnterpriseP='enterprise_plus', got '%s'", TierEnterpriseP)
	}
}

func TestSubscription_Marshaling(t *testing.T) {
	sub := Subscription{
		ID:        "sub123",
		TenantID:  "tenant456",
		Tier:      TierProfessional,
		Status:    "active",
		CreatedAt: time.Now(),
	}

	if sub.ID != "sub123" {
		t.Errorf("expected ID='sub123', got '%s'", sub.ID)
	}
	if sub.Tier != TierProfessional {
		t.Errorf("expected Tier='professional', got '%s'", sub.Tier)
	}
	if sub.Status != "active" {
		t.Errorf("expected Status='active', got '%s'", sub.Status)
	}
}
