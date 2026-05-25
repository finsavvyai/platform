package notification

import (
	"strings"
	"testing"
	"time"
)

func TestRenderHighRiskEmail(t *testing.T) {
	vars := AlertVars{
		Severity:     "critical",
		EntityName:   "Hassan Ali Mohammad",
		EntityType:   "individual",
		Score:        0.94,
		ListSource:   "OFAC SDN",
		MatchReason:  "Exact + phonetic match",
		AlertID:      "alrt_abc123",
		DashboardURL: "https://app.amliq.finance/alerts/alrt_abc123",
		Timestamp:    time.Date(2026, 4, 14, 10, 30, 0, 0, time.UTC),
	}
	subject, body, err := Render(TplHighRiskEmail, vars)
	if err != nil {
		t.Fatalf("Render: %v", err)
	}
	if !strings.Contains(subject, "Hassan Ali Mohammad") {
		t.Errorf("subject missing entity: %s", subject)
	}
	if !strings.Contains(body, "OFAC SDN") {
		t.Errorf("body missing list")
	}
	if !strings.Contains(body, "94%") {
		t.Errorf("body missing confidence")
	}
}

func TestRenderSMS(t *testing.T) {
	_, body, err := Render(TplHighRiskSMS, AlertVars{
		EntityName: "Ivan Petrov", Score: 0.87,
		ListSource: "EU Consolidated",
		DashboardURL: "https://app.amliq.finance/x",
	})
	if err != nil {
		t.Fatalf("Render: %v", err)
	}
	if !strings.Contains(body, "Ivan Petrov") || !strings.Contains(body, "87%") {
		t.Errorf("SMS body incorrect: %s", body)
	}
}

func TestRenderWhatsApp(t *testing.T) {
	_, body, err := Render(TplHighRiskWhatsApp, AlertVars{
		Severity: "high", EntityName: "Acme Corp",
		EntityType: "company", Score: 0.76,
		ListSource: "UN Sanctions",
		MatchReason: "Fuzzy match",
		DashboardURL: "https://x",
	})
	if err != nil {
		t.Fatalf("Render: %v", err)
	}
	if !strings.Contains(body, "🟠") || !strings.Contains(body, "Acme Corp") {
		t.Errorf("WhatsApp body missing formatting: %s", body)
	}
}

func TestUnknownTemplate(t *testing.T) {
	_, _, err := Render("nonexistent", AlertVars{})
	if err == nil {
		t.Error("expected error for unknown template")
	}
}
