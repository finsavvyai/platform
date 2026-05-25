// Package notification — alert message templates with variable substitution.
package notification

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"
	"time"
)

// AlertVars are the variables available in every alert template.
type AlertVars struct {
	// Event metadata
	Event       string    // "match.high_risk" | "alert.created" | ...
	Severity    string    // "critical" | "high" | "medium" | "low"
	Timestamp   time.Time //
	TenantName  string    // "Acme Bank"
	DashboardURL string   // "https://app.amliq.finance/alerts/abc123"

	// Matched entity
	EntityName    string
	EntityType    string // "individual" | "company" | "vessel"
	EntityCountry string

	// Match details
	Score       float64 // 0.0 - 1.0
	Confidence  string  // "94%" (rendered)
	ListSource  string  // "OFAC SDN"
	ListCount   int     // how many lists matched
	MatchReason string  // "Exact + phonetic match"

	// Optional context
	AlertID     string
	CaseID      string
	AnalystName string
	Notes       string
}

// TemplateKey identifies which template to use.
type TemplateKey string

const (
	TplHighRiskEmail    TemplateKey = "high_risk_email"
	TplHighRiskSMS      TemplateKey = "high_risk_sms"
	TplHighRiskWhatsApp TemplateKey = "high_risk_whatsapp"
	TplAlertCreated     TemplateKey = "alert_created"
	TplCaseEscalated    TemplateKey = "case_escalated"
	TplSLABreach        TemplateKey = "sla_breach"
	TplDailyDigest      TemplateKey = "daily_digest"
)

// Render fills the template with vars and returns (subject, body).
func Render(key TemplateKey, vars AlertVars) (subject, body string, err error) {
	tpl, ok := templates[key]
	if !ok {
		return "", "", fmt.Errorf("unknown template: %s", key)
	}
	if vars.Confidence == "" {
		vars.Confidence = fmt.Sprintf("%.0f%%", vars.Score*100)
	}
	if vars.Timestamp.IsZero() {
		vars.Timestamp = time.Now()
	}
	subject, err = exec(tpl.Subject, vars)
	if err != nil {
		return "", "", err
	}
	body, err = exec(tpl.Body, vars)
	return subject, body, err
}

func exec(raw string, vars AlertVars) (string, error) {
	t, err := template.New("").Funcs(funcMap).Parse(raw)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, vars); err != nil {
		return "", err
	}
	return strings.TrimSpace(buf.String()), nil
}

var funcMap = template.FuncMap{
	"upper":  strings.ToUpper,
	"lower":  strings.ToLower,
	"fmtTime": func(t time.Time) string { return t.Format("2006-01-02 15:04 MST") },
	"fmtDate": func(t time.Time) string { return t.Format("Jan 2, 2006") },
	"severityEmoji": func(sev string) string {
		switch strings.ToLower(sev) {
		case "critical":
			return "🔴"
		case "high":
			return "🟠"
		case "medium":
			return "🟡"
		case "low":
			return "🟢"
		}
		return "⚪"
	},
}
