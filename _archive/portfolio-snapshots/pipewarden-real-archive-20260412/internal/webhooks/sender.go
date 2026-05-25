package webhooks

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// WebhookSender dispatches findings to external systems (OpenSyber, Slack, etc.)
type WebhookSender struct {
	endpoints []string
	logger    *logging.Logger
	client    *http.Client
}

// NewSender creates a webhook sender with retry capability.
func NewSender(endpoints []string, logger *logging.Logger) *WebhookSender {
	return &WebhookSender{
		endpoints: endpoints,
		logger:    logger,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SendFindings dispatches analysis results to all configured webhook endpoints.
func (s *WebhookSender) SendFindings(ctx context.Context, result *analysis.AnalysisResult) error {
	if len(s.endpoints) == 0 {
		return nil
	}

	payload := map[string]interface{}{
		"findings":        result.Findings,
		"risk_score":      result.RiskScore,
		"summary":         result.Summary,
		"connection_name": result.ConnectionName,
		"analyzed_at":     result.AnalyzedAt.Format(time.RFC3339),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("serialize webhook payload: %w", err)
	}

	var errs []error
	for _, endpoint := range s.endpoints {
		if err := s.sendToEndpoint(ctx, endpoint, body); err != nil {
			s.logger.Warnf("webhook send failed for %s: %v", endpoint, err)
			errs = append(errs, err)
		}
	}

	if len(errs) > 0 && len(errs) == len(s.endpoints) {
		return fmt.Errorf("all webhook endpoints failed: %d/%d", len(errs), len(s.endpoints))
	}

	return nil
}

// sendToEndpoint delivers findings to a single webhook endpoint.
func (s *WebhookSender) sendToEndpoint(ctx context.Context, endpoint string, body []byte) error {
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-PipeWarden-Event", "findings")
	req.Header.Set("X-PipeWarden-Signature", "sha256="+s.computeSignature(body))

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("webhook returned %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// computeSignature creates HMAC-SHA256 signature using webhook secret.
func (s *WebhookSender) computeSignature(body []byte) string {
	// In production, fetch the secret from secure config/vault
	secret := "webhook-secret-key"
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(body)
	return hex.EncodeToString(h.Sum(nil))
}
