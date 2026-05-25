package providers

import (
	"context"
	"fmt"
	"net/http"
)

type CircleCIProvider struct {
	cfg Config
	cli *http.Client
}

func NewCircleCI(cfg Config) *CircleCIProvider {
	return &CircleCIProvider{
		cfg: cfg,
		cli: &http.Client{},
	}
}

func (p *CircleCIProvider) Name() string {
	return "circleci"
}

func (p *CircleCIProvider) TestConnection(ctx context.Context) error {
	if p.cfg.Token == "" {
		return fmt.Errorf("missing token")
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://circleci.com/api/v2/me", nil)
	if err != nil {
		return err
	}

	req.Header.Set("Circle-Token", p.cfg.Token)
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

func (p *CircleCIProvider) GetLogs(ctx context.Context, jobName string) ([]LogEntry, error) {
	return []LogEntry{}, nil
}
