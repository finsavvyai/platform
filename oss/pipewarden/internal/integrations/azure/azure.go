package azure

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// Config holds Azure DevOps-specific configuration.
type Config struct {
	Organization string
	Project      string
	Token        string // Personal Access Token
	BaseURL      string
}

// Client implements integrations.Provider for Azure DevOps.
type Client struct {
	config     Config
	httpClient *http.Client
	logger     *logging.Logger
}

// NewClient creates a new Azure DevOps client.
func NewClient(cfg Config, logger *logging.Logger) *Client {
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
	return integrations.PlatformAzureDevOps
}

// TestConnection verifies that credentials are valid and the API is reachable.
func (c *Client) TestConnection(ctx context.Context) (*integrations.ConnectionStatus, error) {
	start := time.Now()

	path := fmt.Sprintf("/%s/_apis/projects?api-version=7.1", c.config.Organization)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("azure devops connection test failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	latency := time.Since(start)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &integrations.ConnectionStatus{
			Connected: false,
			Platform:  integrations.PlatformAzureDevOps,
			Latency:   latency,
			Message:   fmt.Sprintf("authentication failed (HTTP %d): %s", resp.StatusCode, string(body)),
		}, nil
	}

	var result projectsResponse
	if err := decodeJSON(resp, &result); err != nil {
		return nil, fmt.Errorf("failed to decode projects response: %w", err)
	}

	return &integrations.ConnectionStatus{
		Connected:   true,
		Platform:    integrations.PlatformAzureDevOps,
		User:        c.config.Organization,
		RateLimitOK: true,
		Latency:     latency,
		Message:     fmt.Sprintf("connected to Azure DevOps (%d projects accessible)", result.Count),
	}, nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	url := strings.TrimRight(c.baseURL(), "/") + path
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}

	// Basic auth with PAT: username is ignored (use ":"), password is the token
	auth := base64.StdEncoding.EncodeToString([]byte(":" + c.config.Token))
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(req)
}

func (c *Client) baseURL() string {
	if c.config.BaseURL != "" {
		return c.config.BaseURL
	}
	return "https://dev.azure.com"
}

// Azure DevOps API response types

type projectsResponse struct {
	Count int `json:"count"`
	Value []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"value"`
}
