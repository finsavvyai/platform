package providers

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
)

type AzureDevOpsProvider struct {
	cfg Config
	cli *http.Client
}

func NewAzureDevOps(cfg Config) *AzureDevOpsProvider {
	return &AzureDevOpsProvider{
		cfg: cfg,
		cli: &http.Client{},
	}
}

func (p *AzureDevOpsProvider) Name() string {
	return "azure"
}

func (p *AzureDevOpsProvider) TestConnection(ctx context.Context) error {
	if p.cfg.BaseURL == "" {
		return fmt.Errorf("missing base URL")
	}

	if p.cfg.Token == "" {
		return fmt.Errorf("missing token")
	}

	auth := base64.StdEncoding.EncodeToString([]byte(":" + p.cfg.Token))
	req, err := http.NewRequestWithContext(ctx, "GET", p.cfg.BaseURL+"/_apis/projects", nil)
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Basic "+auth)
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

func (p *AzureDevOpsProvider) GetLogs(ctx context.Context, jobName string) ([]LogEntry, error) {
	return []LogEntry{}, nil
}
