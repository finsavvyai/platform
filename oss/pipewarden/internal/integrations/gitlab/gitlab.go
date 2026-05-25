package gitlab

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

// Config holds GitLab-specific configuration.
type Config struct {
	Token   string
	BaseURL string // defaults to https://gitlab.com/api/v4
}

// Client implements integrations.Provider for GitLab CI/CD.
type Client struct {
	config     Config
	httpClient *http.Client
	logger     *logging.Logger
}

// NewClient creates a new GitLab CI/CD client.
func NewClient(cfg Config, logger *logging.Logger) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://gitlab.com/api/v4"
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
// (unauthenticated GitLab reads on public projects) call this to know
// whether the authenticated /user check is appropriate.
func (c *Client) HasToken() bool {
	return c.config.Token != ""
}

// Name returns the platform identifier.
func (c *Client) Name() integrations.Platform {
	return integrations.PlatformGitLab
}

// TestConnection verifies that credentials are valid and the API is reachable.
func (c *Client) TestConnection(ctx context.Context) (*integrations.ConnectionStatus, error) {
	start := time.Now()

	resp, err := c.doRequest(ctx, http.MethodGet, "/user", nil)
	if err != nil {
		return nil, fmt.Errorf("gitlab connection test failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	latency := time.Since(start)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return &integrations.ConnectionStatus{
			Connected: false,
			Platform:  integrations.PlatformGitLab,
			Latency:   latency,
			Message:   fmt.Sprintf("authentication failed (HTTP %d): %s", resp.StatusCode, string(body)),
		}, nil
	}

	var user glUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user response: %w", err)
	}

	scopes := parseTokenScopes(resp.Header)

	return &integrations.ConnectionStatus{
		Connected:   true,
		Platform:    integrations.PlatformGitLab,
		User:        user.Username,
		Scopes:      scopes,
		RateLimitOK: resp.Header.Get("RateLimit-Remaining") != "0",
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

	if c.config.Token != "" {
		req.Header.Set("PRIVATE-TOKEN", c.config.Token)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "pipewarden")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(req)
}

// GitLab API response types

type glUser struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Name     string `json:"name"`
	Email    string `json:"email"`
}

type glPipeline struct {
	ID     int    `json:"id"`
	Status string `json:"status"`
	Ref    string `json:"ref"`
	SHA    string `json:"sha"`
	WebURL string `json:"web_url"`
}

type glPipelineDetail struct {
	ID         int       `json:"id"`
	Status     string    `json:"status"`
	Ref        string    `json:"ref"`
	SHA        string    `json:"sha"`
	WebURL     string    `json:"web_url"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	StartedAt  time.Time `json:"started_at"`
	FinishedAt time.Time `json:"finished_at"`
}

func parseTokenScopes(headers http.Header) []string {
	scopeHeader := headers.Get("X-Oauth-Scopes")
	if scopeHeader == "" {
		return []string{"api"}
	}
	parts := strings.Split(scopeHeader, ",")
	scopes := make([]string, 0, len(parts))
	for _, s := range parts {
		s = strings.TrimSpace(s)
		if s != "" {
			scopes = append(scopes, s)
		}
	}
	return scopes
}
