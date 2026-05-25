package gitlab

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// ListPipelines returns GitLab CI/CD pipelines for a repository.
func (c *Client) ListPipelines(ctx context.Context, owner, repo string) ([]integrations.Pipeline, error) {
	projectID := fmt.Sprintf("%s%%2F%s", owner, repo)
	path := fmt.Sprintf("/projects/%s/pipelines?per_page=25&order_by=id&sort=desc", projectID)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list pipelines: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gitlab API error: HTTP %d", resp.StatusCode)
	}

	var glPipelines []glPipeline
	if err := json.NewDecoder(resp.Body).Decode(&glPipelines); err != nil {
		return nil, fmt.Errorf("failed to decode pipelines: %w", err)
	}

	pipelines := make([]integrations.Pipeline, 0, len(glPipelines))
	for _, p := range glPipelines {
		pipelines = append(pipelines, integrations.Pipeline{
			ID:         fmt.Sprintf("%d", p.ID),
			Name:       fmt.Sprintf("Pipeline #%d", p.ID),
			Platform:   integrations.PlatformGitLab,
			Repository: fmt.Sprintf("%s/%s", owner, repo),
			URL:        p.WebURL,
		})
	}
	return pipelines, nil
}

// GetPipelineRun returns details of a specific pipeline run.
func (c *Client) GetPipelineRun(ctx context.Context, owner, repo, runID string) (*integrations.PipelineRun, error) {
	projectID := fmt.Sprintf("%s%%2F%s", owner, repo)
	path := fmt.Sprintf("/projects/%s/pipelines/%s", projectID, runID)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get pipeline: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gitlab API error: HTTP %d", resp.StatusCode)
	}

	var pipeline glPipelineDetail
	if err := json.NewDecoder(resp.Body).Decode(&pipeline); err != nil {
		return nil, fmt.Errorf("failed to decode pipeline: %w", err)
	}

	return convertPipeline(&pipeline), nil
}

// ListPipelineRuns returns recent pipeline runs for a repository.
func (c *Client) ListPipelineRuns(ctx context.Context, owner, repo string, limit int) ([]integrations.PipelineRun, error) {
	projectID := fmt.Sprintf("%s%%2F%s", owner, repo)
	path := fmt.Sprintf("/projects/%s/pipelines?per_page=%d&order_by=id&sort=desc", projectID, limit)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list pipeline runs: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gitlab API error: HTTP %d", resp.StatusCode)
	}

	var glPipelines []glPipelineDetail
	if err := json.NewDecoder(resp.Body).Decode(&glPipelines); err != nil {
		return nil, fmt.Errorf("failed to decode pipelines: %w", err)
	}

	runs := make([]integrations.PipelineRun, 0, len(glPipelines))
	for i := range glPipelines {
		runs = append(runs, *convertPipeline(&glPipelines[i]))
	}
	return runs, nil
}

// TriggerPipeline creates a new pipeline run on the given branch.
func (c *Client) TriggerPipeline(ctx context.Context, owner, repo, _ string, branch string) (*integrations.PipelineRun, error) {
	projectID := fmt.Sprintf("%s%%2F%s", owner, repo)
	path := fmt.Sprintf("/projects/%s/pipeline?ref=%s", projectID, branch)
	resp, err := c.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to trigger pipeline: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gitlab API error (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var pipeline glPipelineDetail
	if err := json.NewDecoder(resp.Body).Decode(&pipeline); err != nil {
		return nil, fmt.Errorf("failed to decode triggered pipeline: %w", err)
	}

	return convertPipeline(&pipeline), nil
}

func convertPipeline(p *glPipelineDetail) *integrations.PipelineRun {
	// GitLab leaves started_at null for not-yet-started pipelines (pending,
	// waiting_for_resource). Fall back to created_at so consumers always
	// get a usable timestamp ordering.
	startedAt := p.StartedAt
	if startedAt.IsZero() {
		startedAt = p.CreatedAt
	}
	return &integrations.PipelineRun{
		ID:         fmt.Sprintf("%d", p.ID),
		PipelineID: fmt.Sprintf("%d", p.ID),
		Status:     mapGitLabStatus(p.Status),
		Branch:     p.Ref,
		CommitSHA:  p.SHA,
		StartedAt:  startedAt,
		FinishedAt: p.FinishedAt,
		URL:        p.WebURL,
	}
}

// mapGitLabStatus maps GitLab CI/CD pipeline.status to a pipewarden
// PipelineStatus. GitLab statuses: created, waiting_for_resource,
// preparing, pending, running, success, failed, canceled, skipped,
// manual, scheduled.
func mapGitLabStatus(status string) integrations.PipelineStatus {
	switch strings.ToLower(status) {
	case "created", "pending", "waiting_for_resource", "preparing", "scheduled", "manual":
		return integrations.StatusPending
	case "running":
		return integrations.StatusRunning
	case "success":
		return integrations.StatusSuccess
	case "failed":
		return integrations.StatusFailed
	case "canceled", "cancelled", "skipped":
		return integrations.StatusCancelled
	default:
		return integrations.StatusUnknown
	}
}
