package analysis

import (
	"strings"
	"testing"
)

// findPatternMatch returns the first finding with the given pattern name.
func findPatternMatch(findings []DLPFinding, name string) *DLPFinding {
	for i := range findings {
		if findings[i].Pattern == name {
			return &findings[i]
		}
	}
	return nil
}

func TestDLPScanner_AnthropicAPIKey(t *testing.T) {
	scanner := NewDLPScanner()
	cases := []string{
		"ANTHROPIC_API_KEY=sk-ant-api03-" + strings.Repeat("A1b2C3d4_-", 10),
		"key: sk-ant-" + strings.Repeat("xyz", 20),
	}
	for _, content := range cases {
		findings := scanner.ScanContent(content, ".env")
		if findPatternMatch(findings, "Anthropic API Key") == nil {
			t.Errorf("expected Anthropic API Key match in %q", content[:30])
		}
	}
}

func TestDLPScanner_AnthropicNotMatchedAsOpenAI(t *testing.T) {
	scanner := NewDLPScanner()
	content := "ANTHROPIC_API_KEY=sk-ant-api03-" + strings.Repeat("A1b2C3", 12)
	findings := scanner.ScanContent(content, ".env")

	// Anthropic must match but OpenAI must NOT (the previous false positive).
	if findPatternMatch(findings, "Anthropic API Key") == nil {
		t.Error("expected Anthropic API Key match")
	}
	if findPatternMatch(findings, "OpenAI API Key") != nil {
		t.Error("OpenAI pattern must not match Anthropic keys (sk-ant- prefix)")
	}
}

func TestDLPScanner_OpenAIProjectKey(t *testing.T) {
	scanner := NewDLPScanner()
	content := "OPENAI_API_KEY=sk-proj-" + strings.Repeat("a1B2c3D4", 8)
	findings := scanner.ScanContent(content, ".env")
	if findPatternMatch(findings, "OpenAI API Key") == nil {
		t.Error("expected OpenAI API Key match for sk-proj- prefix")
	}
}

func TestDLPScanner_OpenAILegacyKey(t *testing.T) {
	scanner := NewDLPScanner()
	content := "OPENAI_API_KEY=sk-T3BlbkFJ" + strings.Repeat("a1B2c3D4", 6)
	findings := scanner.ScanContent(content, ".env")
	if findPatternMatch(findings, "OpenAI API Key") == nil {
		t.Error("expected OpenAI API Key match for legacy sk-T3Blbk prefix")
	}
}

func TestDLPScanner_StripeLiveKey(t *testing.T) {
	scanner := NewDLPScanner()
	content := "STRIPE_SECRET=sk_live_" + strings.Repeat("a1B2c3D4", 5)
	findings := scanner.ScanContent(content, ".env")
	if findPatternMatch(findings, "Stripe Secret Key") == nil {
		t.Error("expected Stripe Secret Key match")
	}
}

func TestDLPScanner_StripeTestKey(t *testing.T) {
	scanner := NewDLPScanner()
	content := "STRIPE_TEST=sk_test_" + strings.Repeat("a1B2c3D4", 5)
	findings := scanner.ScanContent(content, ".env")
	if findPatternMatch(findings, "Stripe Secret Key") == nil {
		t.Error("expected Stripe Secret Key match for sk_test_ keys")
	}
}

func TestDLPScanner_CloudflareToken(t *testing.T) {
	scanner := NewDLPScanner()
	content := "CLOUDFLARE_API_TOKEN=" + strings.Repeat("Ab1_-", 8) // exactly 40 chars
	findings := scanner.ScanContent(content, ".env")
	if findPatternMatch(findings, "Cloudflare API Token") == nil {
		t.Errorf("expected Cloudflare API Token match in %q", content)
	}
}

func TestDLPScanner_GoogleAPIKey(t *testing.T) {
	scanner := NewDLPScanner()
	// AIza prefix + 35 chars body = 39 chars total (canonical Google API key).
	body := strings.Repeat("a1B2_", 7) // 35 chars
	content := "GOOGLE_API_KEY=AIza" + body
	findings := scanner.ScanContent(content, ".env")
	if findPatternMatch(findings, "Google API Key") == nil {
		t.Errorf("expected Google API Key match in %q", content)
	}
}

func TestDLPScanner_NPMToken(t *testing.T) {
	scanner := NewDLPScanner()
	body := strings.Repeat("ab12CD34", 5) // 40 chars; pattern needs 36
	content := "NPM_TOKEN=npm_" + body[:36]
	findings := scanner.ScanContent(content, ".env")
	if findPatternMatch(findings, "npm Token") == nil {
		t.Errorf("expected npm Token match in %q", content)
	}
}

func TestDLPScanner_GenericSecretAssignment(t *testing.T) {
	scanner := NewDLPScanner()
	cases := []string{
		"DATABASE_PASSWORD=" + strings.Repeat("a1B2", 9),
		"my_secret = '" + strings.Repeat("Z9y8x7", 6) + "'",
		"api_token: " + strings.Repeat("Q1w2E3", 7),
	}
	for _, content := range cases {
		findings := scanner.ScanContent(content, ".env")
		if findPatternMatch(findings, "Generic Secret Assignment") == nil {
			t.Errorf("expected Generic Secret Assignment match in %q", content)
		}
	}
}

func TestDLPScanner_GenericSecret_DoesNotMatchShortValues(t *testing.T) {
	scanner := NewDLPScanner()
	// Short value (under 32 chars) — should NOT match Generic Secret Assignment.
	content := "DEBUG_TOKEN=short"
	findings := scanner.ScanContent(content, ".env")
	if findPatternMatch(findings, "Generic Secret Assignment") != nil {
		t.Error("Generic Secret Assignment must not match short values (<32 chars)")
	}
}
