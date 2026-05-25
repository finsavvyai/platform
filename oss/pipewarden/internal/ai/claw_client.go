package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/logging"
)

const (
	defaultClawBaseURL = "https://claw.lunaos.ai/v1"
	defaultClawTimeout = 30 * time.Second
)

// ClawConfig holds configuration for the Claw Gateway client.
type ClawConfig struct {
	APIKey    string
	ProjectID string
	BaseURL   string // defaults to https://claw.lunaos.ai/v1
}

// ClawClient is an HTTP client for the Claw Gateway API.
type ClawClient struct {
	config     ClawConfig
	httpClient *http.Client
	logger     *logging.Logger
}

// ClawRequest represents a request to the Claw Gateway.
type ClawRequest struct {
	ProjectID string            `json:"project_id"`
	Action    string            `json:"action"`
	Payload   map[string]string `json:"payload"`
}

// ClawResponse represents a response from the Claw Gateway.
type ClawResponse struct {
	ID        string          `json:"id"`
	Status    string          `json:"status"`
	Data      json.RawMessage `json:"data"`
	Usage     ClawUsage       `json:"usage"`
	CreatedAt time.Time       `json:"created_at"`
}

// ClawUsage tracks token/credit usage from Claw Gateway.
type ClawUsage struct {
	CreditsUsed int `json:"credits_used"`
	TokensIn    int `json:"tokens_in"`
	TokensOut   int `json:"tokens_out"`
}

// NewClawClient creates a new Claw Gateway client.
func NewClawClient(cfg ClawConfig, logger *logging.Logger) *ClawClient {
	if cfg.BaseURL == "" {
		cfg.BaseURL = defaultClawBaseURL
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")

	return &ClawClient{
		config: cfg,
		httpClient: &http.Client{
			Timeout: defaultClawTimeout,
		},
		logger: logger,
	}
}

// SetHTTPClient allows overriding the HTTP client for testing.
func (c *ClawClient) SetHTTPClient(client *http.Client) {
	c.httpClient = client
}

// Enabled returns whether the client has credentials configured.
func (c *ClawClient) Enabled() bool {
	return c.config.APIKey != "" && c.config.ProjectID != ""
}

// Analyze sends a security analysis request to Claw Gateway.
func (c *ClawClient) Analyze(ctx context.Context, action string, payload map[string]string) (*ClawResponse, error) {
	req := ClawRequest{
		ProjectID: c.config.ProjectID,
		Action:    action,
		Payload:   payload,
	}

	c.logger.Infow("Sending request to Claw Gateway",
		"action", action,
		"project_id", c.config.ProjectID,
	)

	resp, err := c.doRequest(ctx, "/analyze", req)
	if err != nil {
		return nil, fmt.Errorf("claw gateway request failed: %w", err)
	}

	c.logger.Infow("Claw Gateway response received",
		"action", action,
		"status", resp.Status,
		"credits_used", resp.Usage.CreditsUsed,
	)

	return resp, nil
}

// HealthCheck verifies connectivity to the Claw Gateway.
func (c *ClawClient) HealthCheck(ctx context.Context) error {
	url := c.config.BaseURL + "/health"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create health request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("claw health check failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("claw health check returned HTTP %d", resp.StatusCode)
	}

	return nil
}

func (c *ClawClient) doRequest(ctx context.Context, path string, payload interface{}) (*ClawResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := c.config.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	req.Header.Set("X-Project-ID", c.config.ProjectID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claw API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var result ClawResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
