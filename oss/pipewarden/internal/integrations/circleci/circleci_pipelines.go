package circleci

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// ListPipelines returns CircleCI pipelines for a project.
func (c *Client) ListPipelines(ctx context.Context, owner, repo string) ([]integrations.Pipeline, error) {
	projectSlug := fmt.Sprintf("gh/%s/%s", owner, repo)
	path := fmt.Sprintf("/project/%s/pipeline", projectSlug)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list pipelines: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("circleci API error: HTTP %d", resp.StatusCode)
	}

	var result ccPipelinesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode pipelines: %w", err)
	}

	pipelines := make([]integrations.Pipeline, 0, len(result.Items))
	for _, p := range result.Items {
		nameSuffix := p.ID
		if len(nameSuffix) > 8 {
			nameSuffix = nameSuffix[:8]
		}
		pipelines = append(pipelines, integrations.Pipeline{
			ID:         p.ID,
			Name:       fmt.Sprintf("Pipeline %s", nameSuffix),
			Platform:   integrations.PlatformCircleCI,
			Repository: fmt.Sprintf("%s/%s", owner, repo),
			URL:        fmt.Sprintf("https://app.circleci.com/pipelines/%s/%s", owner, repo),
		})
	}
	return pipelines, nil
}

// GetPipelineRun returns details of a specific pipeline run.
func (c *Client) GetPipelineRun(ctx context.Context, owner, repo, runID string) (*integrations.PipelineRun, error) {
	projectSlug := fmt.Sprintf("gh/%s/%s", owner, repo)
	path := fmt.Sprintf("/project/%s/pipeline/%s", projectSlug, runID)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get pipeline: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("circleci API error: HTTP %d", resp.StatusCode)
	}

	var pipeline ccPipeline
	if err := json.NewDecoder(resp.Body).Decode(&pipeline); err != nil {
		return nil, fmt.Errorf("failed to decode pipeline: %w", err)
	}
	return convertPipeline(&pipeline), nil
}

// ListPipelineRuns returns recent pipeline runs for a project.
func (c *Client) ListPipelineRuns(ctx context.Context, owner, repo string, limit int) ([]integrations.PipelineRun, error) {
	projectSlug := fmt.Sprintf("gh/%s/%s", owner, repo)
	path := fmt.Sprintf("/project/%s/pipeline?limit=%d", projectSlug, limit)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list pipelines: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("circleci API error: HTTP %d", resp.StatusCode)
	}

	var result ccPipelinesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode pipelines: %w", err)
	}

	runs := make([]integrations.PipelineRun, 0, len(result.Items))
	for i := range result.Items {
		runs = append(runs, *convertPipeline(&result.Items[i]))
	}
	return runs, nil
}

// TriggerPipeline triggers a new pipeline run on the given branch.
func (c *Client) TriggerPipeline(ctx context.Context, owner, repo, workflow, branch string) (*integrations.PipelineRun, error) {
	projectSlug := fmt.Sprintf("gh/%s/%s", owner, repo)
	path := fmt.Sprintf("/project/%s/pipeline", projectSlug)
	body := fmt.Sprintf(`{"branch":"%s"}`, branch)
	resp, err := c.doRequest(ctx, http.MethodPost, path, strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to trigger pipeline: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("circleci API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var pipeline ccPipeline
	if err := json.NewDecoder(resp.Body).Decode(&pipeline); err != nil {
		return nil, fmt.Errorf("failed to decode pipeline response: %w", err)
	}
	return convertPipeline(&pipeline), nil
}

func convertPipeline(p *ccPipeline) *integrations.PipelineRun {
	return &integrations.PipelineRun{
		ID:         p.ID,
		Status:     mapCircleCIStatus(p.State),
		Branch:     p.VCS.Branch,
		CommitSHA:  p.VCS.SHA,
		StartedAt:  p.CreatedAt,
		FinishedAt: p.UpdatedAt,
		Duration:   p.UpdatedAt.Sub(p.CreatedAt),
		URL:        fmt.Sprintf("https://app.circleci.com/pipelines/%s", p.ID),
	}
}

func mapCircleCIStatus(state string) integrations.PipelineStatus {
	switch state {
	case "pending":
		return integrations.StatusPending
	case "running":
		return integrations.StatusRunning
	case "success":
		return integrations.StatusSuccess
	case "failed":
		return integrations.StatusFailed
	case "canceled":
		return integrations.StatusCancelled
	default:
		return integrations.StatusUnknown
	}
}
