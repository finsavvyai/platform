package security

import (
	"testing"
)

func TestNewAuditor(t *testing.T) {
	corsHeaders := map[string]string{
		"Access-Control-Allow-Origin": "*",
	}

	auditor := New(true, corsHeaders, true, true)

	if auditor == nil {
		t.Fatal("expected auditor, got nil")
	}

	if !auditor.encryptionEnabled {
		t.Error("expected encryption enabled")
	}

	if !auditor.cspEnabled {
		t.Error("expected CSP enabled")
	}

	if !auditor.tlsRequired {
		t.Error("expected TLS required")
	}
}

func TestAuditWithAllChecksPassing(t *testing.T) {
	corsHeaders := map[string]string{
		"Access-Control-Allow-Origin": "https://trusted.example.com",
	}

	auditor := New(true, corsHeaders, true, true)
	report := auditor.Audit()

	if report == nil {
		t.Fatal("expected report, got nil")
	}

	if report.FailCount != 0 {
		t.Errorf("expected 0 failures, got %d", report.FailCount)
	}

	if report.PassCount == 0 {
		t.Error("expected at least 1 passing check")
	}

	if report.RiskScore != 0 {
		t.Errorf("expected risk score 0, got %d", report.RiskScore)
	}

	if !report.IsSecure() {
		t.Error("expected IsSecure() to return true")
	}
}

func TestAuditWithEncryptionDisabled(t *testing.T) {
	corsHeaders := map[string]string{
		"Access-Control-Allow-Origin": "*",
	}

	auditor := New(false, corsHeaders, true, true)
	report := auditor.Audit()

	if report.FailCount == 0 {
		t.Error("expected failures when encryption disabled")
	}

	if report.IsSecure() {
		t.Error("expected IsSecure() to return false")
	}

	if report.RiskScore == 0 {
		t.Error("expected non-zero risk score when checks fail")
	}
}

func TestAuditWithoutCORSHeaders(t *testing.T) {
	auditor := New(true, map[string]string{}, true, true)
	report := auditor.Audit()

	if report.FailCount == 0 {
		t.Error("expected failures without CORS headers")
	}

	found := false
	for _, check := range report.Checks {
		if check.Name == "CORS Configuration" && !check.Status {
			found = true
			break
		}
	}

	if !found {
		t.Error("expected CORS Configuration check to fail")
	}
}

func TestAuditWithoutTLS(t *testing.T) {
	corsHeaders := map[string]string{
		"Access-Control-Allow-Origin": "*",
	}

	auditor := New(true, corsHeaders, true, false)
	report := auditor.Audit()

	found := false
	for _, check := range report.Checks {
		if check.Name == "TLS/HTTPS Enforcement" && !check.Status {
			found = true
			break
		}
	}

	if !found {
		t.Error("expected TLS check to fail when TLS not required")
	}
}

func TestAuditWithoutCSP(t *testing.T) {
	corsHeaders := map[string]string{
		"Access-Control-Allow-Origin": "*",
	}

	auditor := New(true, corsHeaders, false, true)
	report := auditor.Audit()

	found := false
	for _, check := range report.Checks {
		if check.Name == "Cross-Site Scripting (XSS) Protection" && !check.Status {
			found = true
			break
		}
	}

	if !found {
		t.Error("expected XSS check to fail when CSP not enabled")
	}
}

func TestReportSummary(t *testing.T) {
	corsHeaders := map[string]string{
		"Access-Control-Allow-Origin": "*",
	}

	auditor := New(true, corsHeaders, true, true)
	report := auditor.Audit()

	summary := report.Summary()
	if summary == "" {
		t.Error("expected non-empty summary")
	}

	if len(report.Checks) == 0 {
		t.Error("expected at least one check in report")
	}
}

func TestRiskScoreCalculation(t *testing.T) {
	// All checks failing should result in max risk score
	auditor := New(false, map[string]string{}, false, false)
	report := auditor.Audit()

	// 6 checks * 15 points = 90, but capped at 100
	if report.RiskScore == 0 {
		t.Error("expected non-zero risk score")
	}

	if report.RiskScore > 100 {
		t.Errorf("risk score should not exceed 100, got %d", report.RiskScore)
	}
}
