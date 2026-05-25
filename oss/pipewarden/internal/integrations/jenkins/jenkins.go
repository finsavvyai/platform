package jenkins

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// Config holds Jenkins-specific configuration.
type Config struct {
	BaseURL  string
	Username string
	APIToken string
}

// Client implements integrations.Provider for Jenkins.
type Client struct {
	config     Config
	httpClient *http.Client
	logger     *logging.Logger
}

// NewClient creates a new Jenkins client.
func NewClient(cfg Config, logger *logging.Logger) *Client {
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
	return integrations.PlatformJenkins
}

// TestConnection verifies that credentials are valid and the API is reachable.
func (c *Client) TestConnection(ctx context.Context) (*integrations.ConnectionStatus, error) {
	start := time.Now()

	resp, err := c.doRequest(ctx, http.MethodGet, "/api/json", nil)
	if err != nil {
		return nil, fmt.Errorf("jenkins connection test failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	latency := time.Since(start)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &integrations.ConnectionStatus{
			Connected: false,
			Platform:  integrations.PlatformJenkins,
			Latency:   latency,
			Message:   fmt.Sprintf("authentication failed (HTTP %d): %s", resp.StatusCode, string(body)),
		}, nil
	}

	var serverInfo jenkinsServer
	if err := json.NewDecoder(resp.Body).Decode(&serverInfo); err != nil {
		return nil, fmt.Errorf("failed to decode server response: %w", err)
	}

	return &integrations.ConnectionStatus{
		Connected:   true,
		Platform:    integrations.PlatformJenkins,
		User:        c.config.Username,
		RateLimitOK: true,
		Latency:     latency,
		Message:     fmt.Sprintf("connected to Jenkins %s", serverInfo.Version),
	}, nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	url := c.config.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}

	// Basic auth: username:apitoken
	auth := base64.StdEncoding.EncodeToString([]byte(c.config.Username + ":" + c.config.APIToken))
	req.Header.Set("Authorization", "Basic "+auth)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(req)
}

// Jenkins API response types

type jenkinsServer struct {
	Version string `json:"version"`
}

type jenkinsJob struct {
	Name  string `json:"name"`
	URL   string `json:"url"`
	Color string `json:"color"`
}

type jenkinsJobsResponse struct {
	Jobs []jenkinsJob `json:"jobs"`
}

type jenkinsBuild struct {
	Number    int64  `json:"number"`
	Result    string `json:"result"`
	Timestamp int64  `json:"timestamp"`
	Duration  int64  `json:"duration"`
	URL       string `json:"url"`
	Building  bool   `json:"building"`
}

type jenkinsJobResponse struct {
	Name   string         `json:"name"`
	Builds []jenkinsBuild `json:"builds"`
}
