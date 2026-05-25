package bitbucket

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

// Config holds Bitbucket-specific configuration.
type Config struct {
	Username    string
	AppPassword string
	BaseURL     string // defaults to https://api.bitbucket.org/2.0
}

// Client implements integrations.Provider for Bitbucket Pipelines.
type Client struct {
	config     Config
	httpClient *http.Client
	logger     *logging.Logger
}

// NewClient creates a new Bitbucket Pipelines client.
func NewClient(cfg Config, logger *logging.Logger) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.bitbucket.org/2.0"
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
	return integrations.PlatformBitbucket
}

// TestConnection verifies that credentials are valid and the API is reachable.
func (c *Client) TestConnection(ctx context.Context) (*integrations.ConnectionStatus, error) {
	start := time.Now()

	resp, err := c.doRequest(ctx, http.MethodGet, "/user", nil)
	if err != nil {
		return nil, fmt.Errorf("bitbucket connection test failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	latency := time.Since(start)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &integrations.ConnectionStatus{
			Connected: false,
			Platform:  integrations.PlatformBitbucket,
			Latency:   latency,
			Message:   fmt.Sprintf("authentication failed (HTTP %d): %s", resp.StatusCode, string(body)),
		}, nil
	}

	var user bbUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user response: %w", err)
	}

	return &integrations.ConnectionStatus{
		Connected:   true,
		Platform:    integrations.PlatformBitbucket,
		User:        user.Username,
		Scopes:      []string{"pipeline", "repository"},
		RateLimitOK: true,
		Latency:     latency,
		Message:     fmt.Sprintf("connected as %s", user.DisplayName),
	}, nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	url := c.config.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}

	req.SetBasicAuth(c.config.Username, c.config.AppPassword)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(req)
}

// Bitbucket API response types

type bbUser struct {
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	UUID        string `json:"uuid"`
}

type bbPipeline struct {
	UUID        string    `json:"uuid"`
	BuildNumber int       `json:"build_number"`
	CreatedOn   time.Time `json:"created_on"`
	CompletedOn time.Time `json:"completed_on"`
	State       bbState   `json:"state"`
	Target      bbTarget  `json:"target"`
}

type bbState struct {
	Name   string   `json:"name"`
	Result bbResult `json:"result"`
}

type bbResult struct {
	Name string `json:"name"`
}

type bbTarget struct {
	RefType string   `json:"ref_type"`
	RefName string   `json:"ref_name"`
	Commit  bbCommit `json:"commit"`
}

type bbCommit struct {
	Hash string `json:"hash"`
}

type bbPipelinesResponse struct {
	Values []bbPipeline `json:"values"`
	Size   int          `json:"size"`
}
