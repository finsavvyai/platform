package siem

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

const pdEventsV2URL = "https://events.pagerduty.com/v2/enqueue"

// PagerDutyConfig holds PagerDuty Events API v2 configuration.
type PagerDutyConfig struct {
	IntegrationKey string // Routing key from PD service integration
}

// PagerDutyNotifier sends alerts to PagerDuty.
type PagerDutyNotifier struct {
	config     PagerDutyConfig
	httpClient *http.Client
}

// NewPagerDutyNotifier creates a PagerDuty notifier.
func NewPagerDutyNotifier(cfg PagerDutyConfig) *PagerDutyNotifier {
	return &PagerDutyNotifier{
		config:     cfg,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Enabled reports whether PagerDuty is configured.
func (p *PagerDutyNotifier) Enabled() bool {
	return p.config.IntegrationKey != ""
}

// TriggerAlert sends a finding as a PagerDuty alert.
// Only sends for Critical and High severity findings.
func (p *PagerDutyNotifier) TriggerAlert(ctx context.Context, f analysis.Finding, dashURL string) error {
	if !p.Enabled() {
		return nil
	}
	if f.Severity != analysis.SeverityCritical && f.Severity != analysis.SeverityHigh {
		return nil // PD alerts only for critical/high
	}

	dedupKey := fmt.Sprintf("pipewarden-%s-%s-%d", f.ConnectionName, f.RunID, f.ID)
	payload := map[string]interface{}{
		"routing_key":  p.config.IntegrationKey,
		"event_action": "trigger",
		"dedup_key":    dedupKey,
		"payload": map[string]interface{}{
			"summary":   fmt.Sprintf("[%s] %s — %s", strings.ToUpper(string(f.Severity)), f.Title, f.ConnectionName),
			"source":    "PipeWarden",
			"severity":  pdSeverity(f.Severity),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
			"custom_details": map[string]interface{}{
				"connection":  f.ConnectionName,
				"run_id":      f.RunID,
				"category":    string(f.Category),
				"description": f.Description,
				"remediation": f.Remediation,
				"confidence":  f.Confidence,
			},
		},
		"links": buildPDLinks(dashURL),
	}

	return p.send(ctx, payload)
}

// ResolveAlert marks a finding's PagerDuty alert as resolved.
func (p *PagerDutyNotifier) ResolveAlert(ctx context.Context, f analysis.Finding) error {
	if !p.Enabled() {
		return nil
	}
	dedupKey := fmt.Sprintf("pipewarden-%s-%s-%d", f.ConnectionName, f.RunID, f.ID)
	payload := map[string]interface{}{
		"routing_key":  p.config.IntegrationKey,
		"event_action": "resolve",
		"dedup_key":    dedupKey,
	}
	return p.send(ctx, payload)
}

func (p *PagerDutyNotifier) send(ctx context.Context, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal pd payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, pdEventsV2URL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create pd request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("pd request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("pagerduty error (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func pdSeverity(s analysis.Severity) string {
	switch s {
	case analysis.SeverityCritical:
		return "critical"
	case analysis.SeverityHigh:
		return "error"
	case analysis.SeverityMedium:
		return "warning"
	default:
		return "info"
	}
}

func buildPDLinks(dashURL string) []map[string]string {
	if dashURL == "" {
		return nil
	}
	return []map[string]string{{"href": dashURL, "text": "Open in PipeWarden"}}
}
