package circleci

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// Config holds CircleCI-specific configuration.
type Config struct {
	Token   string
	BaseURL string // defaults to https://api.circleci.com/v2
}

// Client implements integrations.Provider for CircleCI.
type Client struct {
	config     Config
	httpClient *http.Client
	logger     *logging.Logger
}

// NewClient creates a new CircleCI client.
func NewClient(cfg Config, logger *logging.Logger) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.circleci.com/v2"
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")

	return &Client{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

// SetHTTPClient allows overriding the default HTTP client (useful for testing).
func (c *Client) SetHTTPClient(client *http.Client) {
	c.httpClient = client
}

// Name returns the platform identifier.
func (c *Client) Name() integrations.Platform {
	return integrations.PlatformCircleCI
}

// TestConnection verifies that credentials are valid and the API is reachable.
func (c *Client) TestConnection(ctx context.Context) (*integrations.ConnectionStatus, error) {
	start := time.Now()

	resp, err := c.doRequest(ctx, http.MethodGet, "/me", nil)
	if err != nil {
		return nil, fmt.Errorf("circleci connection test failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	latency := time.Since(start)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &integrations.ConnectionStatus{
			Connected: false,
			Platform:  integrations.PlatformCircleCI,
			Latency:   latency,
			Message:   fmt.Sprintf("authentication failed (HTTP %d): %s", resp.StatusCode, string(body)),
		}, nil
	}

	var user ccUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user response: %w", err)
	}

	return &integrations.ConnectionStatus{
		Connected:   true,
		Platform:    integrations.PlatformCircleCI,
		User:        user.Name,
		Scopes:      []string{"read:org", "write:org"},
		RateLimitOK: true,
		Latency:     latency,
		Message:     fmt.Sprintf("connected as %s", user.Name),
	}, nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	url := c.config.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Circle-Token", c.config.Token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(req)
}

// CircleCI API response types

type ccUser struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type ccPipeline struct {
	ID        string    `json:"id"`
	Number    int       `json:"number"`
	State     string    `json:"state"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	VCS       ccVCS     `json:"vcs"`
}

type ccVCS struct {
	Branch string `json:"branch"`
	SHA    string `json:"revision"`
}

type ccPipelinesResponse struct {
	Items         []ccPipeline `json:"items"`
	NextPageToken string       `json:"next_page_token,omitempty"`
}
