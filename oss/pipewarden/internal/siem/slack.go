package siem

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

// SlackConfig holds the Slack webhook configuration.
type SlackConfig struct {
	WebhookURL string // Slack incoming webhook URL
	Channel    string // optional override channel
	Username   string // optional bot username (default: PipeWarden)
}

// SlackNotifier sends security findings to Slack using Block Kit.
type SlackNotifier struct {
	config     SlackConfig
	httpClient *http.Client
}

// NewSlackNotifier creates a Slack notifier.
func NewSlackNotifier(cfg SlackConfig) *SlackNotifier {
	return &SlackNotifier{
		config:     cfg,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Enabled reports whether the notifier is configured.
func (s *SlackNotifier) Enabled() bool {
	return s.config.WebhookURL != ""
}

// SendFinding posts a finding to Slack with Block Kit formatting.
func (s *SlackNotifier) SendFinding(ctx context.Context, f analysis.Finding, dashboardURL string) error {
	if !s.Enabled() {
		return nil
	}
	payload := s.buildFindingPayload(f, dashboardURL)
	return s.send(ctx, payload)
}

// SendBatch sends a summary of multiple findings in a single message.
func (s *SlackNotifier) SendBatch(ctx context.Context, findings []analysis.Finding, connName, runID, dashURL string) error {
	if !s.Enabled() || len(findings) == 0 {
		return nil
	}
	payload := s.buildBatchPayload(findings, connName, runID, dashURL)
	return s.send(ctx, payload)
}

func (s *SlackNotifier) send(ctx context.Context, payload interface{}) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal slack payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.config.WebhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create slack request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("slack request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("slack webhook error (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func severityEmoji(s analysis.Severity) string {
	switch s {
	case analysis.SeverityCritical:
		return "🔴"
	case analysis.SeverityHigh:
		return "🟠"
	case analysis.SeverityMedium:
		return "🟡"
	default:
		return "⚪"
	}
}

func severityColor(s analysis.Severity) string {
	switch s {
	case analysis.SeverityCritical:
		return "#FF0000"
	case analysis.SeverityHigh:
		return "#FF6600"
	case analysis.SeverityMedium:
		return "#FFD700"
	default:
		return "#808080"
	}
}
