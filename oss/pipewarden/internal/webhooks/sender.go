package webhooks

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/finsavvyai/pipewarden/internal/logging"
)

// FindingEvent represents a security finding to be sent via webhook.
type FindingEvent struct {
	ID             int64     `json:"id"`
	ConnectionName string    `json:"connection_name"`
	RunID          string    `json:"run_id"`
	Severity       string    `json:"severity"`
	Category       string    `json:"category,omitempty"`
	Title          string    `json:"title"`
	Description    string    `json:"description,omitempty"`
	Remediation    string    `json:"remediation,omitempty"`
	File           string    `json:"file,omitempty"`
	Line           int       `json:"line,omitempty"`
	Confidence     float64   `json:"confidence,omitempty"`
	Status         string    `json:"status,omitempty"`
	Timestamp      time.Time `json:"timestamp"`
}

// WebhookSender pushes security findings to external webhooks with HMAC signing.
type WebhookSender struct {
	endpoint string
	secret   string
	client   *http.Client
	logger   *logging.Logger
}

// NewWebhookSender creates a new webhook sender.
func NewWebhookSender(endpoint, secret string, logger *logging.Logger) *WebhookSender {
	return &WebhookSender{
		endpoint: endpoint,
		secret:   secret,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger: logger,
	}
}

// SendFinding sends a single finding via webhook with HMAC-SHA256 signature.
func (w *WebhookSender) SendFinding(ctx context.Context, finding FindingEvent) error {
	if w.endpoint == "" || w.secret == "" {
		return nil // Webhook disabled
	}

	// Ensure timestamp is set
	if finding.Timestamp.IsZero() {
		finding.Timestamp = time.Now()
	}

	// Marshal finding
	payload, err := json.Marshal(finding)
	if err != nil {
		w.logger.Errorw("failed to marshal finding", "error", err)
		return fmt.Errorf("marshal error: %w", err)
	}

	statusCode, err := w.sendJSON(ctx, payload, "finding.created")
	if err != nil {
		return err
	}
	if statusCode < 200 || statusCode >= 300 {
		w.logger.Warnw("webhook rejected",
			"status", statusCode,
			"findingID", finding.ID,
			"title", finding.Title,
		)
		return fmt.Errorf("unexpected status %d", statusCode)
	}

	w.logger.Debugw("finding sent via webhook",
		"findingID", finding.ID,
		"title", finding.Title,
		"severity", finding.Severity,
	)

	return nil
}

// SendTestEvent sends a signed generic test payload to validate webhook delivery.
func (w *WebhookSender) SendTestEvent(ctx context.Context, payload map[string]interface{}) (int, error) {
	if w.endpoint == "" || w.secret == "" {
		return 0, nil
	}
	if payload == nil {
		payload = map[string]interface{}{
			"event":     "test",
			"timestamp": time.Now().UTC(),
			"message":   "Test webhook delivery",
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return 0, fmt.Errorf("marshal error: %w", err)
	}
	return w.sendJSON(ctx, body, "webhook.test")
}

// generateSignature creates an HMAC-SHA256 signature for the payload.
func (w *WebhookSender) generateSignature(payload []byte) string {
	h := hmac.New(sha256.New, []byte(w.secret))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}

// SendFindings sends multiple findings in batch.
func (w *WebhookSender) SendFindings(ctx context.Context, findings []FindingEvent) error {
	for _, finding := range findings {
		if err := w.SendFinding(ctx, finding); err != nil {
			return fmt.Errorf("failed to send finding %d: %w", finding.ID, err)
		}
	}
	return nil
}

func (w *WebhookSender) sendJSON(ctx context.Context, payload []byte, eventType string) (int, error) {
	signature := w.generateSignature(payload)
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		w.endpoint,
		bytes.NewReader(payload),
	)
	if err != nil {
		w.logger.Errorw("failed to create webhook request", "error", err)
		return 0, fmt.Errorf("request creation error: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-PipeWarden-Signature", signature)
	req.Header.Set("X-PipeWarden-Event", eventType)
	req.Header.Set("X-PipeWarden-Timestamp", time.Now().UTC().Format(time.RFC3339))
	req.Header.Set("User-Agent", "PipeWarden/1.0")

	resp, err := w.client.Do(req)
	if err != nil {
		w.logger.Errorw("failed to send webhook", "error", err, "endpoint", w.endpoint)
		return 0, fmt.Errorf("send error: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	return resp.StatusCode, nil
}
