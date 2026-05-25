package github

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

// Config holds GitHub-specific configuration.
type Config struct {
	Token   string
	BaseURL string // defaults to https://api.github.com
}

// Client implements integrations.Provider for GitHub Actions.
type Client struct {
	config     Config
	httpClient *http.Client
	logger     *logging.Logger
}

// NewClient creates a new GitHub Actions client.
func NewClient(cfg Config, logger *logging.Logger) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://api.github.com"
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

// HasToken reports whether a token was configured. Public-read flows
// (unauthenticated GitHub reads up to 60 req/h) call this to know
// whether the authenticated /user check is appropriate.
func (c *Client) HasToken() bool {
	return c.config.Token != ""
}

// Name returns the platform identifier.
func (c *Client) Name() integrations.Platform {
	return integrations.PlatformGitHub
}

// TestConnection verifies that credentials are valid and the API is reachable.
func (c *Client) TestConnection(ctx context.Context) (*integrations.ConnectionStatus, error) {
	start := time.Now()

	resp, err := c.doRequest(ctx, http.MethodGet, "/user", nil)
	if err != nil {
		return nil, fmt.Errorf("github connection test failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	latency := time.Since(start)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &integrations.ConnectionStatus{
			Connected: false,
			Platform:  integrations.PlatformGitHub,
			Latency:   latency,
			Message:   fmt.Sprintf("authentication failed (HTTP %d): %s", resp.StatusCode, string(body)),
		}, nil
	}

	var user ghUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user response: %w", err)
	}

	scopes := parseScopes(resp.Header.Get("X-OAuth-Scopes"))

	return &integrations.ConnectionStatus{
		Connected:   true,
		Platform:    integrations.PlatformGitHub,
		User:        user.Login,
		Scopes:      scopes,
		RateLimitOK: resp.Header.Get("X-RateLimit-Remaining") != "0",
		Latency:     latency,
		Message:     fmt.Sprintf("connected as %s", user.Login),
	}, nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	url := c.config.BaseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}

	if c.config.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.Token)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "pipewarden")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(req)
}

// GitHub API response types

type ghUser struct {
	Login string `json:"login"`
	ID    int    `json:"id"`
}

type ghWorkflow struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	Path    string `json:"path"`
	State   string `json:"state"`
	HTMLURL string `json:"html_url"`
}

type ghWorkflowsResponse struct {
	TotalCount int          `json:"total_count"`
	Workflows  []ghWorkflow `json:"workflows"`
}

type ghWorkflowRun struct {
	ID           int       `json:"id"`
	Name         string    `json:"name"`
	WorkflowID   int       `json:"workflow_id"`
	Status       string    `json:"status"`
	Conclusion   string    `json:"conclusion"`
	HeadBranch   string    `json:"head_branch"`
	HeadSHA      string    `json:"head_sha"`
	HTMLURL      string    `json:"html_url"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	RunStartedAt time.Time `json:"run_started_at"`
}

type ghRunsResponse struct {
	TotalCount   int             `json:"total_count"`
	WorkflowRuns []ghWorkflowRun `json:"workflow_runs"`
}

func parseScopes(header string) []string {
	if header == "" {
		return nil
	}
	parts := strings.Split(header, ",")
	scopes := make([]string, 0, len(parts))
	for _, p := range parts {
		s := strings.TrimSpace(p)
		if s != "" {
			scopes = append(scopes, s)
		}
	}
	return scopes
}
