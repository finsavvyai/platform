package azure

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// ListPipelines returns pipelines for the configured project.
func (c *Client) ListPipelines(ctx context.Context, owner, repo string) ([]integrations.Pipeline, error) {
	path := fmt.Sprintf("/%s/%s/_apis/pipelines?api-version=7.1", c.config.Organization, c.config.Project)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("azure devops: failed to list pipelines: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("azure devops API error: HTTP %d", resp.StatusCode)
	}

	var result pipelinesResponse
	if err := decodeJSON(resp, &result); err != nil {
		return nil, fmt.Errorf("azure devops: failed to decode pipelines: %w", err)
	}

	pipelines := make([]integrations.Pipeline, 0, len(result.Value))
	for _, p := range result.Value {
		pipelines = append(pipelines, integrations.Pipeline{
			ID:       fmt.Sprintf("%d", p.ID),
			Name:     p.Name,
			Platform: integrations.PlatformAzureDevOps,
			URL:      p.URL,
		})
	}
	return pipelines, nil
}

// GetPipelineRun returns details of a specific pipeline run.
func (c *Client) GetPipelineRun(ctx context.Context, owner, repo, runID string) (*integrations.PipelineRun, error) {
	path := fmt.Sprintf("/%s/%s/_apis/pipelines/%s/runs/%s?api-version=7.1", c.config.Organization, c.config.Project, owner, runID)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("azure devops: failed to get run: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("azure devops API error: HTTP %d", resp.StatusCode)
	}

	var run pipelineRun
	if err := decodeJSON(resp, &run); err != nil {
		return nil, fmt.Errorf("azure devops: failed to decode run: %w", err)
	}

	return convertRun(&run), nil
}

// ListPipelineRuns returns recent runs for a pipeline.
func (c *Client) ListPipelineRuns(ctx context.Context, owner, repo string, limit int) ([]integrations.PipelineRun, error) {
	path := fmt.Sprintf("/%s/%s/_apis/pipelines/%s/runs?api-version=7.1&$top=%d", c.config.Organization, c.config.Project, owner, limit)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("azure devops: failed to list runs: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("azure devops API error: HTTP %d", resp.StatusCode)
	}

	var result runsResponse
	if err := decodeJSON(resp, &result); err != nil {
		return nil, fmt.Errorf("azure devops: failed to decode runs: %w", err)
	}

	runs := make([]integrations.PipelineRun, 0, len(result.Value))
	for _, r := range result.Value {
		runs = append(runs, *convertRun(&r))
	}
	return runs, nil
}

// TriggerPipeline starts a new pipeline run.
func (c *Client) TriggerPipeline(ctx context.Context, owner, repo, workflow, branch string) (*integrations.PipelineRun, error) {
	path := fmt.Sprintf("/%s/%s/_apis/pipelines/%s/runs?api-version=7.1", c.config.Organization, c.config.Project, owner)

	body := fmt.Sprintf(`{"resources":{"repositories":{"self":{"refName":"refs/heads/%s"}}},"templateParameters":{}}`, branch)
	resp, err := c.doRequest(ctx, http.MethodPost, path, strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("azure devops: failed to trigger pipeline: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("azure devops API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var run pipelineRun
	if err := decodeJSON(resp, &run); err != nil {
		return nil, fmt.Errorf("azure devops: failed to decode triggered run: %w", err)
	}

	return convertRun(&run), nil
}

type pipelinesResponse struct {
	Count int `json:"count"`
	Value []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
		URL  string `json:"url"`
	} `json:"value"`
}

type pipelineRun struct {
	ID           int       `json:"id"`
	Name         string    `json:"name"`
	State        string    `json:"state"`
	Result       string    `json:"result"`
	CreatedDate  time.Time `json:"createdDate"`
	FinishedDate time.Time `json:"finishedDate"`
	URL          string    `json:"url"`
}

type runsResponse struct {
	Count int           `json:"count"`
	Value []pipelineRun `json:"value"`
}

func decodeJSON(resp *http.Response, v interface{}) error {
	return json.NewDecoder(resp.Body).Decode(v)
}

func convertRun(run *pipelineRun) *integrations.PipelineRun {
	status := mapAzureStatus(run.State, run.Result)

	return &integrations.PipelineRun{
		ID:         fmt.Sprintf("%d", run.ID),
		Status:     status,
		StartedAt:  run.CreatedDate,
		FinishedAt: run.FinishedDate,
		Duration:   run.FinishedDate.Sub(run.CreatedDate),
		URL:        run.URL,
	}
}

func mapAzureStatus(state, result string) integrations.PipelineStatus {
	if state == "inProgress" {
		return integrations.StatusRunning
	}

	switch state {
	case "completed":
		switch result {
		case "succeeded":
			return integrations.StatusSuccess
		case "failed":
			return integrations.StatusFailed
		case "canceled":
			return integrations.StatusCancelled
		default:
			return integrations.StatusUnknown
		}
	case "notStarted":
		return integrations.StatusPending
	default:
		return integrations.StatusUnknown
	}
}
