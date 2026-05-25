package clawpipe

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultBaseURL = "https://api.clawpipe.ai"

// Config holds configuration for the ClawPipe gateway client.
type Config struct {
	APIKey    string
	ProjectID string
	BaseURL   string // default: https://api.clawpipe.ai
}

// Client is a HTTP client for the ClawPipe gateway API.
type Client struct {
	config     Config
	httpClient *http.Client
}

// PromptOptions holds options for a prompt request.
type PromptOptions struct {
	Model       string
	Temperature float64
	MaxTokens   int
}

// PromptResponse holds the response from a prompt request.
type PromptResponse struct {
	Text string
	Meta ResponseMeta
}

// ResponseMeta holds metadata about the response.
type ResponseMeta struct {
	Cached        bool
	Boosted       bool
	Model         string
	Provider      string
	InputTokens   int
	OutputTokens  int
	LatencyMs     int
	EstimatedCost float64
}

// ClawPipe API request and response types

type clawpipeRequest struct {
	Prompt  string          `json:"prompt"`
	Options clawpipeOptions `json:"options"`
}

type clawpipeOptions struct {
	Model       string  `json:"model"`
	Temperature float64 `json:"temperature"`
	MaxTokens   int     `json:"maxTokens"`
}

type clawpipeResponse struct {
	Text string       `json:"text"`
	Meta clawpipeMeta `json:"meta"`
}

type clawpipeMeta struct {
	Cached        bool    `json:"cached"`
	Boosted       bool    `json:"boosted"`
	Model         string  `json:"model"`
	Provider      string  `json:"provider"`
	InputTokens   int     `json:"inputTokens"`
	OutputTokens  int     `json:"outputTokens"`
	LatencyMs     int     `json:"latencyMs"`
	EstimatedCost float64 `json:"estimatedCost"`
}

// NewClient creates a new ClawPipe gateway client.
func NewClient(cfg Config) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = defaultBaseURL
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")

	return &Client{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// SetHTTPClient allows overriding the HTTP client for testing.
func (c *Client) SetHTTPClient(client *http.Client) {
	c.httpClient = client
}

// Prompt sends a prompt to the ClawPipe gateway and returns the response.
func (c *Client) Prompt(ctx context.Context, prompt string, opts PromptOptions) (*PromptResponse, error) {
	reqBody := clawpipeRequest{
		Prompt:  prompt,
		Options: clawpipeOptions(opts),
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.BaseURL+"/prompt", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.config.APIKey))
	if c.config.ProjectID != "" {
		req.Header.Set("X-Project-ID", c.config.ProjectID)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("clawpipe API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var result clawpipeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &PromptResponse{
		Text: result.Text,
		Meta: ResponseMeta{
			Cached:        result.Meta.Cached,
			Boosted:       result.Meta.Boosted,
			Model:         result.Meta.Model,
			Provider:      result.Meta.Provider,
			InputTokens:   result.Meta.InputTokens,
			OutputTokens:  result.Meta.OutputTokens,
			LatencyMs:     result.Meta.LatencyMs,
			EstimatedCost: result.Meta.EstimatedCost,
		},
	}, nil
}

// Enabled returns whether the client has credentials configured.
func (c *Client) Enabled() bool {
	return c.config.APIKey != ""
}
