package providers

import (
	"context"
	"fmt"
	"net/http"
)

type JenkinsProvider struct {
	cfg Config
	cli *http.Client
}

func NewJenkins(cfg Config) *JenkinsProvider {
	return &JenkinsProvider{
		cfg: cfg,
		cli: &http.Client{},
	}
}

func (p *JenkinsProvider) Name() string {
	return "jenkins"
}

func (p *JenkinsProvider) TestConnection(ctx context.Context) error {
	if p.cfg.BaseURL == "" {
		return fmt.Errorf("missing base URL")
	}

	if p.cfg.Token == "" {
		return fmt.Errorf("missing token")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", p.cfg.BaseURL+"/api/json", nil)
	if err != nil {
		return err
	}

	req.SetBasicAuth(p.cfg.Username, p.cfg.Token)
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

func (p *JenkinsProvider) GetLogs(ctx context.Context, jobName string) ([]LogEntry, error) {
	return []LogEntry{}, nil
}
