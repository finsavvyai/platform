package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// ListPipelines returns GitHub Actions workflows for a repository.
func (c *Client) ListPipelines(ctx context.Context, owner, repo string) ([]integrations.Pipeline, error) {
	path := fmt.Sprintf("/repos/%s/%s/actions/workflows", owner, repo)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list workflows: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github API error: HTTP %d", resp.StatusCode)
	}

	var result ghWorkflowsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode workflows: %w", err)
	}

	pipelines := make([]integrations.Pipeline, 0, len(result.Workflows))
	for _, w := range result.Workflows {
		pipelines = append(pipelines, integrations.Pipeline{
			ID:         fmt.Sprintf("%d", w.ID),
			Name:       w.Name,
			Platform:   integrations.PlatformGitHub,
			Repository: fmt.Sprintf("%s/%s", owner, repo),
			URL:        w.HTMLURL,
		})
	}
	return pipelines, nil
}

// GetPipelineRun returns details of a specific workflow run.
func (c *Client) GetPipelineRun(ctx context.Context, owner, repo, runID string) (*integrations.PipelineRun, error) {
	path := fmt.Sprintf("/repos/%s/%s/actions/runs/%s", owner, repo, runID)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get run: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github API error: HTTP %d", resp.StatusCode)
	}

	var run ghWorkflowRun
	if err := json.NewDecoder(resp.Body).Decode(&run); err != nil {
		return nil, fmt.Errorf("failed to decode run: %w", err)
	}

	return convertRun(&run), nil
}

// ListPipelineRuns returns recent workflow runs for a repository.
func (c *Client) ListPipelineRuns(ctx context.Context, owner, repo string, limit int) ([]integrations.PipelineRun, error) {
	path := fmt.Sprintf("/repos/%s/%s/actions/runs?per_page=%d", owner, repo, limit)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list runs: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github API error: HTTP %d", resp.StatusCode)
	}

	var result ghRunsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode runs: %w", err)
	}

	runs := make([]integrations.PipelineRun, 0, len(result.WorkflowRuns))
	for i := range result.WorkflowRuns {
		runs = append(runs, *convertRun(&result.WorkflowRuns[i]))
	}
	return runs, nil
}

// TriggerPipeline dispatches a workflow run on the given branch.
func (c *Client) TriggerPipeline(ctx context.Context, owner, repo, workflow, branch string) (*integrations.PipelineRun, error) {
	path := fmt.Sprintf("/repos/%s/%s/actions/workflows/%s/dispatches", owner, repo, workflow)
	body := fmt.Sprintf(`{"ref":"%s"}`, branch)
	resp, err := c.doRequest(ctx, http.MethodPost, path, strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to trigger workflow: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusNoContent {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	return &integrations.PipelineRun{
		Status: integrations.StatusPending,
		Branch: branch,
	}, nil
}

func convertRun(run *ghWorkflowRun) *integrations.PipelineRun {
	return &integrations.PipelineRun{
		ID:         fmt.Sprintf("%d", run.ID),
		PipelineID: fmt.Sprintf("%d", run.WorkflowID),
		Status:     mapGitHubStatus(run.Status, run.Conclusion),
		Branch:     run.HeadBranch,
		CommitSHA:  run.HeadSHA,
		StartedAt:  run.RunStartedAt,
		FinishedAt: run.UpdatedAt,
		URL:        run.HTMLURL,
	}
}

// mapGitHubStatus maps the (status, conclusion) tuple from the GitHub
// Actions API to a pipewarden PipelineStatus.
//
// GitHub run statuses: queued, in_progress, completed, waiting, pending,
// requested, action_required.
// GitHub run conclusions (only set when status=completed): success,
// failure, cancelled, neutral, skipped, timed_out, action_required,
// startup_failure, stale.
func mapGitHubStatus(status, conclusion string) integrations.PipelineStatus {
	switch status {
	case "queued", "waiting", "pending", "requested":
		return integrations.StatusPending
	case "in_progress":
		return integrations.StatusRunning
	case "action_required":
		// Top-level status — workflow paused waiting on a manual approval.
		return integrations.StatusPending
	case "completed":
		switch conclusion {
		case "success", "neutral":
			return integrations.StatusSuccess
		case "failure", "startup_failure":
			return integrations.StatusFailed
		case "timed_out":
			return integrations.StatusTimedOut
		case "cancelled":
			return integrations.StatusCancelled
		case "skipped", "stale":
			return integrations.StatusCancelled
		case "action_required":
			return integrations.StatusPending
		default:
			return integrations.StatusUnknown
		}
	default:
		return integrations.StatusUnknown
	}
}
