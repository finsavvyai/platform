package bitbucket

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// ListPipelines returns Bitbucket Pipelines for a repository.
func (c *Client) ListPipelines(ctx context.Context, owner, repo string) ([]integrations.Pipeline, error) {
	path := fmt.Sprintf("/repositories/%s/%s/pipelines/?sort=-created_on&pagelen=25", owner, repo)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list pipelines: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bitbucket API error: HTTP %d", resp.StatusCode)
	}

	var result bbPipelinesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode pipelines: %w", err)
	}

	pipelines := make([]integrations.Pipeline, 0, len(result.Values))
	for _, p := range result.Values {
		pipelines = append(pipelines, integrations.Pipeline{
			ID:         p.UUID,
			Name:       fmt.Sprintf("Pipeline #%d", p.BuildNumber),
			Platform:   integrations.PlatformBitbucket,
			Repository: fmt.Sprintf("%s/%s", owner, repo),
			URL:        fmt.Sprintf("https://bitbucket.org/%s/%s/pipelines/results/%d", owner, repo, p.BuildNumber),
		})
	}
	return pipelines, nil
}

// GetPipelineRun returns details of a specific pipeline run.
func (c *Client) GetPipelineRun(ctx context.Context, owner, repo, runID string) (*integrations.PipelineRun, error) {
	path := fmt.Sprintf("/repositories/%s/%s/pipelines/%s", owner, repo, runID)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get pipeline: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bitbucket API error: HTTP %d", resp.StatusCode)
	}

	var pipeline bbPipeline
	if err := json.NewDecoder(resp.Body).Decode(&pipeline); err != nil {
		return nil, fmt.Errorf("failed to decode pipeline: %w", err)
	}

	return convertPipeline(&pipeline, owner, repo), nil
}

// ListPipelineRuns returns recent pipeline runs for a repository.
func (c *Client) ListPipelineRuns(ctx context.Context, owner, repo string, limit int) ([]integrations.PipelineRun, error) {
	path := fmt.Sprintf("/repositories/%s/%s/pipelines/?sort=-created_on&pagelen=%d", owner, repo, limit)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list pipeline runs: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bitbucket API error: HTTP %d", resp.StatusCode)
	}

	var result bbPipelinesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode pipelines: %w", err)
	}

	runs := make([]integrations.PipelineRun, 0, len(result.Values))
	for i := range result.Values {
		runs = append(runs, *convertPipeline(&result.Values[i], owner, repo))
	}
	return runs, nil
}

// TriggerPipeline creates a new pipeline run on the given branch.
func (c *Client) TriggerPipeline(ctx context.Context, owner, repo, _ string, branch string) (*integrations.PipelineRun, error) {
	path := fmt.Sprintf("/repositories/%s/%s/pipelines/", owner, repo)
	body := fmt.Sprintf(`{"target":{"ref_type":"branch","type":"pipeline_ref_target","ref_name":"%s"}}`, branch)
	resp, err := c.doRequest(ctx, http.MethodPost, path, strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to trigger pipeline: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("bitbucket API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var pipeline bbPipeline
	if err := json.NewDecoder(resp.Body).Decode(&pipeline); err != nil {
		return nil, fmt.Errorf("failed to decode triggered pipeline: %w", err)
	}

	return convertPipeline(&pipeline, owner, repo), nil
}

func convertPipeline(p *bbPipeline, owner, repo string) *integrations.PipelineRun {
	return &integrations.PipelineRun{
		ID:         p.UUID,
		PipelineID: fmt.Sprintf("%d", p.BuildNumber),
		Status:     mapBitbucketStatus(p.State),
		Branch:     p.Target.RefName,
		CommitSHA:  p.Target.Commit.Hash,
		StartedAt:  p.CreatedOn,
		FinishedAt: p.CompletedOn,
		URL:        fmt.Sprintf("https://bitbucket.org/%s/%s/pipelines/results/%d", owner, repo, p.BuildNumber),
	}
}

func mapBitbucketStatus(state bbState) integrations.PipelineStatus {
	switch strings.ToUpper(state.Name) {
	case "PENDING":
		return integrations.StatusPending
	case "IN_PROGRESS", "RUNNING":
		return integrations.StatusRunning
	case "COMPLETED":
		switch strings.ToUpper(state.Result.Name) {
		case "SUCCESSFUL":
			return integrations.StatusSuccess
		case "FAILED", "ERROR":
			return integrations.StatusFailed
		case "STOPPED":
			return integrations.StatusCancelled
		default:
			return integrations.StatusUnknown
		}
	default:
		return integrations.StatusUnknown
	}
}
