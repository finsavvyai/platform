package demo

import (
	"context"
	"fmt"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

const (
	DemoOwner = "demo-org"
	DemoRepo  = "sample-app"
)

// Client is a synthetic provider used for product demos and investor walkthroughs.
type Client struct {
	platform integrations.Platform
	logger   *logging.Logger
}

// NewClient creates a demo provider for the requested platform.
func NewClient(platform integrations.Platform, logger *logging.Logger) *Client {
	if platform == "" {
		platform = integrations.PlatformGitHub
	}
	return &Client{
		platform: platform,
		logger:   logger,
	}
}

func (c *Client) Name() integrations.Platform {
	return c.platform
}

func (c *Client) TestConnection(_ context.Context) (*integrations.ConnectionStatus, error) {
	return &integrations.ConnectionStatus{
		Connected:      true,
		Platform:       c.platform,
		ConnectionName: "demo-workspace",
		User:           "demo-workspace",
		Scopes:         []string{"demo"},
		RateLimitOK:    true,
		Latency:        35 * time.Millisecond,
		Message:        "demo workspace ready",
	}, nil
}

func (c *Client) ListPipelines(_ context.Context, owner, repo string) ([]integrations.Pipeline, error) {
	owner, repo = normalizeRepo(owner, repo)
	return []integrations.Pipeline{
		{
			ID:         "security-review",
			Name:       "Security Review",
			Status:     integrations.StatusSuccess,
			Platform:   c.platform,
			Repository: fmt.Sprintf("%s/%s", owner, repo),
			URL:        "https://demo.pipewarden.local/pipelines/security-review",
		},
		{
			ID:         "release-gate",
			Name:       "Release Gate",
			Status:     integrations.StatusFailed,
			Platform:   c.platform,
			Repository: fmt.Sprintf("%s/%s", owner, repo),
			URL:        "https://demo.pipewarden.local/pipelines/release-gate",
		},
	}, nil
}

func (c *Client) GetPipelineRun(_ context.Context, owner, repo, runID string) (*integrations.PipelineRun, error) {
	owner, repo = normalizeRepo(owner, repo)
	now := time.Now().UTC()

	switch runID {
	case "run-101":
		return &integrations.PipelineRun{
			ID:         "run-101",
			PipelineID: "security-review",
			Status:     integrations.StatusFailed,
			Branch:     "release/2026-04",
			CommitSHA:  "8d3c0b9e4b22",
			StartedAt:  now.Add(-2 * time.Hour),
			FinishedAt: now.Add(-2*time.Hour + 6*time.Minute),
			Duration:   6 * time.Minute,
			URL:        fmt.Sprintf("https://demo.pipewarden.local/%s/%s/runs/run-101", owner, repo),
			Steps: []integrations.PipelineStep{
				{Name: "checkout", Status: integrations.StatusSuccess, StartedAt: now.Add(-2 * time.Hour), Duration: 8 * time.Second},
				{Name: "build", Status: integrations.StatusSuccess, StartedAt: now.Add(-119 * time.Minute), Duration: 95 * time.Second},
				{Name: "test", Status: integrations.StatusFailed, StartedAt: now.Add(-117 * time.Minute), Duration: 2 * time.Minute},
				{Name: "deploy", Status: integrations.StatusCancelled, StartedAt: now.Add(-115 * time.Minute), Duration: 0},
			},
		}, nil
	case "run-103":
		return &integrations.PipelineRun{
			ID:         "run-103",
			PipelineID: "release-gate",
			Status:     integrations.StatusSuccess,
			Branch:     "feature/harden-webhooks",
			CommitSHA:  "1ab29f4b771c",
			StartedAt:  now.Add(-35 * time.Minute),
			FinishedAt: now.Add(-29 * time.Minute),
			Duration:   6 * time.Minute,
			URL:        fmt.Sprintf("https://demo.pipewarden.local/%s/%s/runs/run-103", owner, repo),
			Steps: []integrations.PipelineStep{
				{Name: "checkout", Status: integrations.StatusSuccess, StartedAt: now.Add(-35 * time.Minute), Duration: 10 * time.Second},
				{Name: "lint", Status: integrations.StatusSuccess, StartedAt: now.Add(-34 * time.Minute), Duration: 60 * time.Second},
				{Name: "test", Status: integrations.StatusSuccess, StartedAt: now.Add(-33 * time.Minute), Duration: 2 * time.Minute},
				{Name: "sast", Status: integrations.StatusSuccess, StartedAt: now.Add(-31 * time.Minute), Duration: 75 * time.Second},
				{Name: "deploy", Status: integrations.StatusSuccess, StartedAt: now.Add(-29 * time.Minute), Duration: 70 * time.Second},
			},
		}, nil
	default:
		return &integrations.PipelineRun{
			ID:         "run-102",
			PipelineID: "security-review",
			Status:     integrations.StatusSuccess,
			Branch:     "main",
			CommitSHA:  "4f6c2ce817d4",
			StartedAt:  now.Add(-75 * time.Minute),
			FinishedAt: now.Add(-70 * time.Minute),
			Duration:   5 * time.Minute,
			URL:        fmt.Sprintf("https://demo.pipewarden.local/%s/%s/runs/run-102", owner, repo),
			Steps: []integrations.PipelineStep{
				{Name: "checkout", Status: integrations.StatusSuccess, StartedAt: now.Add(-75 * time.Minute), Duration: 9 * time.Second},
				{Name: "build", Status: integrations.StatusSuccess, StartedAt: now.Add(-74 * time.Minute), Duration: 80 * time.Second},
				{Name: "test", Status: integrations.StatusSuccess, StartedAt: now.Add(-73 * time.Minute), Duration: 2 * time.Minute},
				{Name: "sast", Status: integrations.StatusSuccess, StartedAt: now.Add(-71 * time.Minute), Duration: 65 * time.Second},
				{Name: "deploy", Status: integrations.StatusSuccess, StartedAt: now.Add(-70 * time.Minute), Duration: 55 * time.Second},
			},
		}, nil
	}
}

func (c *Client) ListPipelineRuns(_ context.Context, owner, repo string, limit int) ([]integrations.PipelineRun, error) {
	owner, repo = normalizeRepo(owner, repo)
	ids := []string{"run-103", "run-102", "run-101"}
	if limit > 0 && limit < len(ids) {
		ids = ids[:limit]
	}

	runs := make([]integrations.PipelineRun, 0, len(ids))
	for _, id := range ids {
		run, err := c.GetPipelineRun(context.Background(), owner, repo, id)
		if err != nil {
			return nil, err
		}
		runs = append(runs, *run)
	}
	return runs, nil
}

func (c *Client) TriggerPipeline(_ context.Context, owner, repo, workflow, branch string) (*integrations.PipelineRun, error) {
	owner, repo = normalizeRepo(owner, repo)
	now := time.Now().UTC()
	return &integrations.PipelineRun{
		ID:         "run-104",
		PipelineID: workflow,
		Status:     integrations.StatusPending,
		Branch:     branch,
		CommitSHA:  "pendingdemo123",
		StartedAt:  now,
		URL:        fmt.Sprintf("https://demo.pipewarden.local/%s/%s/runs/run-104", owner, repo),
	}, nil
}

func normalizeRepo(owner, repo string) (string, string) {
	if owner == "" {
		owner = DemoOwner
	}
	if repo == "" {
		repo = DemoRepo
	}
	return owner, repo
}
