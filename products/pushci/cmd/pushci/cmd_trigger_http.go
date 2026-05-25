package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// do wraps the token + accept headers every GitHub REST call needs.
// Returns the body already read so callers can json.Unmarshal once.
func (c *triggerClient) do(ctx context.Context, method, path string, body interface{}) ([]byte, int, error) {
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, rdr) // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req) // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return b, resp.StatusCode,
			fmt.Errorf("github %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return b, resp.StatusCode, nil
}

// findLatestRunDelay is the pause between dispatch and the run-lookup
// GET. GitHub takes ~1s to register a dispatch; 1.5s is a safe
// margin. Exposed for tests to override.
var findLatestRunDelay = 1500 * time.Millisecond

func (c *triggerClient) findLatestRun(ctx context.Context, owner, repo, wf string) (*workflowRun, error) {
	time.Sleep(findLatestRunDelay)
	b, _, err := c.do(ctx, "GET",
		fmt.Sprintf("/repos/%s/%s/actions/workflows/%s/runs?per_page=1", owner, repo, wf), nil)
	if err != nil {
		return nil, err
	}
	var out struct {
		Runs []workflowRun `json:"workflow_runs"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	if len(out.Runs) == 0 {
		return nil, fmt.Errorf("no runs found for workflow %s", wf)
	}
	return &out.Runs[0], nil
}

// getRun fetches a single run by ID for the watch loop.
func (c *triggerClient) getRun(ctx context.Context, owner, repo string, id int64) (*workflowRun, error) {
	b, _, err := c.do(ctx, "GET",
		fmt.Sprintf("/repos/%s/%s/actions/runs/%d", owner, repo, id), nil)
	if err != nil {
		return nil, err
	}
	var wr workflowRun
	return &wr, json.Unmarshal(b, &wr)
}
