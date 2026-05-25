package jenkins

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// ListPipelines returns Jenkins jobs as pipelines.
func (c *Client) ListPipelines(ctx context.Context, owner, repo string) ([]integrations.Pipeline, error) {
	// Jenkins doesn't use owner/repo pattern; we list all jobs
	resp, err := c.doRequest(ctx, http.MethodGet, "/api/json?tree=jobs[name,url,color]", nil)
	if err != nil {
		return nil, fmt.Errorf("jenkins: failed to list jobs: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jenkins API error: HTTP %d", resp.StatusCode)
	}

	var result jenkinsJobsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("jenkins: failed to decode jobs: %w", err)
	}

	pipelines := make([]integrations.Pipeline, 0, len(result.Jobs))
	for _, j := range result.Jobs {
		pipelines = append(pipelines, integrations.Pipeline{
			ID:       j.Name,
			Name:     j.Name,
			Platform: integrations.PlatformJenkins,
			URL:      j.URL,
		})
	}
	return pipelines, nil
}

// GetPipelineRun returns details of a specific Jenkins build.
func (c *Client) GetPipelineRun(ctx context.Context, owner, repo, runID string) (*integrations.PipelineRun, error) {
	path := fmt.Sprintf("/job/%s/%s/api/json", owner, runID)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("jenkins: failed to get build: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jenkins API error: HTTP %d", resp.StatusCode)
	}

	var build jenkinsBuild
	if err := json.NewDecoder(resp.Body).Decode(&build); err != nil {
		return nil, fmt.Errorf("jenkins: failed to decode build: %w", err)
	}

	return convertBuild(&build), nil
}

// ListPipelineRuns returns recent builds for a Jenkins job.
func (c *Client) ListPipelineRuns(ctx context.Context, owner, repo string, limit int) ([]integrations.PipelineRun, error) {
	path := fmt.Sprintf("/job/%s/api/json?tree=builds[number,result,timestamp,duration,url]", owner)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, fmt.Errorf("jenkins: failed to list builds: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jenkins API error: HTTP %d", resp.StatusCode)
	}

	var result jenkinsJobResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("jenkins: failed to decode builds: %w", err)
	}

	runs := make([]integrations.PipelineRun, 0, len(result.Builds))
	count := 0
	for i := range result.Builds {
		if count >= limit {
			break
		}
		runs = append(runs, *convertBuildMinimal(&result.Builds[i]))
		count++
	}
	return runs, nil
}

// TriggerPipeline starts a new Jenkins build.
func (c *Client) TriggerPipeline(ctx context.Context, owner, repo, workflow, branch string) (*integrations.PipelineRun, error) {
	path := fmt.Sprintf("/job/%s/build", owner)
	resp, err := c.doRequest(ctx, http.MethodPost, path, nil)
	if err != nil {
		return nil, fmt.Errorf("jenkins: failed to trigger build: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("jenkins API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	return &integrations.PipelineRun{
		Status: integrations.StatusPending,
		Branch: branch,
	}, nil
}

func convertBuild(build *jenkinsBuild) *integrations.PipelineRun {
	finishedAt := time.Time{}
	if !build.Building && build.Duration > 0 {
		finishedAt = time.UnixMilli(build.Timestamp + build.Duration)
	}
	return &integrations.PipelineRun{
		ID:         fmt.Sprintf("%d", build.Number),
		Status:     mapJenkinsStatus(build.Result, build.Building),
		StartedAt:  time.UnixMilli(build.Timestamp),
		FinishedAt: finishedAt,
		URL:        build.URL,
	}
}

func convertBuildMinimal(build *jenkinsBuild) *integrations.PipelineRun {
	return &integrations.PipelineRun{
		ID:        fmt.Sprintf("%d", build.Number),
		Status:    mapJenkinsStatus(build.Result, build.Building),
		StartedAt: time.UnixMilli(build.Timestamp),
		URL:       build.URL,
	}
}

func mapJenkinsStatus(result string, building bool) integrations.PipelineStatus {
	if building {
		return integrations.StatusRunning
	}
	switch result {
	case "SUCCESS":
		return integrations.StatusSuccess
	case "FAILURE":
		return integrations.StatusFailed
	case "ABORTED":
		return integrations.StatusCancelled
	case "NOT_BUILT":
		return integrations.StatusPending
	default:
		return integrations.StatusUnknown
	}
}
