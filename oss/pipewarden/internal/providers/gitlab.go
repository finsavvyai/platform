package providers

import (
	"context"
	"fmt"
	"net/http"
)

type GitLabProvider struct {
	cfg Config
	cli *http.Client
}

func NewGitLab(cfg Config) *GitLabProvider {
	return &GitLabProvider{
		cfg: cfg,
		cli: &http.Client{},
	}
}

func (p *GitLabProvider) Name() string {
	return "gitlab"
}

func (p *GitLabProvider) TestConnection(ctx context.Context) error {
	if p.cfg.Token == "" {
		return fmt.Errorf("missing token")
	}

	baseURL := p.cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://gitlab.com"
	}

	req, err := http.NewRequestWithContext(ctx, "GET", baseURL+"/api/v4/user", nil)
	if err != nil {
		return err
	}

	req.Header.Set("PRIVATE-TOKEN", p.cfg.Token)
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

func (p *GitLabProvider) GetLogs(ctx context.Context, jobName string) ([]LogEntry, error) {
	return []LogEntry{}, nil
}
