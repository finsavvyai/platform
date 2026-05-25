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

// OpenSREAlert mirrors the OpenSRE alert envelope (schema opensre.alert.v1).
// It is intentionally permissive: only the canonical fields the OpenSRE
// normalizer extracts are required, everything else rides along in labels.
type OpenSREAlert struct {
	AlertName   string            `json:"alert_name"`
	AlertSource string            `json:"alert_source"`
	Severity    string            `json:"severity"`
	Pipeline    string            `json:"pipeline_name,omitempty"`
	Title       string            `json:"title,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// OpenSRESender forwards PipeWarden findings to an OpenSRE /alerts/ingest
// endpoint, signing the body with HMAC-SHA256 in the X-Signature-256 header
// (OpenSRE convention) instead of PipeWarden's X-PipeWarden-Signature.
type OpenSRESender struct {
	endpoint string
	secret   string
	client   *http.Client
	logger   *logging.Logger
}

// NewOpenSRESender builds a sender. When endpoint or secret is empty the
// sender is a no-op so unconfigured deployments do not block finding writes.
func NewOpenSRESender(endpoint, secret string, logger *logging.Logger) *OpenSRESender {
	return &OpenSRESender{
		endpoint: endpoint,
		secret:   secret,
		client:   &http.Client{Timeout: 10 * time.Second},
		logger:   logger,
	}
}

// Enabled reports whether the sender will actually deliver.
func (s *OpenSRESender) Enabled() bool {
	return s.endpoint != "" && s.secret != ""
}

// SendFinding maps a PipeWarden FindingEvent into the OpenSRE alert envelope
// and POSTs it.
func (s *OpenSRESender) SendFinding(ctx context.Context, f FindingEvent) error {
	if !s.Enabled() {
		return nil
	}
	labels := map[string]string{
		"connection": f.ConnectionName,
		"run_id":     f.RunID,
	}
	if f.Category != "" {
		labels["category"] = f.Category
	}
	if f.File != "" {
		labels["file"] = f.File
	}
	annotations := map[string]string{}
	if f.Description != "" {
		annotations["description"] = f.Description
	}
	if f.Remediation != "" {
		annotations["remediation"] = f.Remediation
	}
	alert := OpenSREAlert{
		AlertName:   f.Title,
		AlertSource: "pipewarden",
		Severity:    f.Severity,
		Pipeline:    f.ConnectionName,
		Title:       f.Title,
		Labels:      labels,
		Annotations: annotations,
	}
	body, err := json.Marshal(alert)
	if err != nil {
		return fmt.Errorf("opensre alert marshal: %w", err)
	}
	return s.post(ctx, body)
}

func (s *OpenSRESender) sign(payload []byte) string {
	h := hmac.New(sha256.New, []byte(s.secret))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}

func (s *OpenSRESender) post(ctx context.Context, body []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("opensre request build: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Signature-256", "sha256="+s.sign(body))
	req.Header.Set("User-Agent", "PipeWarden/1.0")
	resp, err := s.client.Do(req)
	if err != nil {
		s.logger.Errorw("opensre alert send failed", "error", err, "endpoint", s.endpoint)
		return fmt.Errorf("opensre send: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		s.logger.Warnw("opensre rejected alert", "status", resp.StatusCode)
		return fmt.Errorf("opensre unexpected status %d", resp.StatusCode)
	}
	s.logger.Debugw("opensre alert delivered", "status", resp.StatusCode)
	return nil
}
