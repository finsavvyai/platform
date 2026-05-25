package webhooks

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/finsavvyai/pipewarden/internal/logging"
)

// AuditEvent represents a trackable action in PipeWarden.
type AuditEvent struct {
	Source       string            `json:"source"`
	Action       string            `json:"action"`        // scan_started, scan_completed, finding_resolved, etc.
	Actor        string            `json:"actor"`         // user or system
	Resource     string            `json:"resource"`      // connection name, finding ID, etc.
	ResourceType string            `json:"resource_type"` // connection, finding, scan, remediation
	Details      map[string]string `json:"details"`
	Timestamp    time.Time         `json:"timestamp"`
}

// AuditSender sends audit events to OpenSyber's audit log.
type AuditSender struct {
	endpoint string
	token    string
	client   *http.Client
	logger   *logging.Logger
}

// NewAuditSender creates a new audit event sender.
func NewAuditSender(endpoint, token string, logger *logging.Logger) *AuditSender {
	return &AuditSender{
		endpoint: endpoint,
		token:    token,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger: logger,
	}
}

// Send sends an audit event to OpenSyber.
func (a *AuditSender) Send(ctx context.Context, event AuditEvent) error {
	if a.endpoint == "" || a.token == "" {
		return nil // Audit disabled
	}

	// Ensure timestamp is set
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Set source to pipewarden if not set
	if event.Source == "" {
		event.Source = "pipewarden"
	}

	// Marshal event
	payload, err := json.Marshal(event)
	if err != nil {
		a.logger.Errorw("failed to marshal audit event", "error", err)
		return fmt.Errorf("marshal error: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		a.endpoint+"/api/integrations/audit",
		bytes.NewReader(payload),
	)
	if err != nil {
		a.logger.Errorw("failed to create audit request", "error", err)
		return fmt.Errorf("request creation error: %w", err)
	}

	// Add headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", a.token))
	req.Header.Set("User-Agent", "PipeWarden/1.0")

	// Send request
	resp, err := a.client.Do(req)
	if err != nil {
		a.logger.Errorw("failed to send audit event", "error", err, "endpoint", a.endpoint)
		return fmt.Errorf("send error: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Check response status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		a.logger.Warnw("audit event rejected",
			"status", resp.StatusCode,
			"action", event.Action,
			"resource", event.Resource,
		)
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	a.logger.Debugw("audit event sent",
		"action", event.Action,
		"resource", event.Resource,
		"resourceType", event.ResourceType,
	)

	return nil
}

// SendScanStarted sends a scan_started event.
