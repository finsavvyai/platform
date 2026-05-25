package providers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
)

type GitHubProvider struct {
	cfg Config
	cli *http.Client
}

func NewGitHub(cfg Config) *GitHubProvider {
	return &GitHubProvider{
		cfg: cfg,
		cli: &http.Client{},
	}
}

func (p *GitHubProvider) Name() string {
	return "github"
}

func (p *GitHubProvider) TestConnection(ctx context.Context) error {
	if p.cfg.Token == "" {
		return fmt.Errorf("missing token")
	}

	baseURL := strings.TrimRight(p.cfg.BaseURL, "/")
	if baseURL == "" {
		baseURL = "https://api.github.com"
	}

	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/user", nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+p.cfg.Token)
	resp, err := p.cli.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("authentication failed: %d", resp.StatusCode)
	}

	return nil
}

func (p *GitHubProvider) GetLogs(ctx context.Context, jobName string) ([]LogEntry, error) {
	return []LogEntry{}, nil
}
