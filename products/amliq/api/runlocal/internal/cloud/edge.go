package cloud

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// EdgeResult is the response from an edge check.
type EdgeResult struct {
	Check   string `json:"check"`
	Passed  bool   `json:"passed"`
	Output  string `json:"output"`
	Elapsed time.Duration
}

// EdgeRunner runs lightweight checks via Cloudflare Workers.
type EdgeRunner struct {
	WorkerURL  string
	HTTPClient *http.Client
}

// NewEdgeRunner creates an edge runner pointing at the given worker URL.
func NewEdgeRunner(workerURL string) *EdgeRunner {
	return &EdgeRunner{
		WorkerURL:  workerURL,
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// edgeChecks lists checks eligible for edge execution.
var edgeChecks = map[string]bool{
	"lint": true, "format": true, "typecheck": true, "line-limit": true,
}

// CanRunOnEdge returns true for lightweight checks.
func (e *EdgeRunner) CanRunOnEdge(check string) bool {
	return edgeChecks[check]
}

// edgeRequest is the payload sent to the CF Worker.
type edgeRequest struct {
	Check string `json:"check"`
	Code  string `json:"code"`
}

// RunOnEdge sends a check to the edge worker and returns the result.
func (e *EdgeRunner) RunOnEdge(ctx context.Context, check, code string) (*EdgeResult, error) {
	if !e.CanRunOnEdge(check) {
		return nil, fmt.Errorf("check %q not supported on edge", check)
	}
	body, _ := json.Marshal(edgeRequest{Check: check, Code: code})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		e.WorkerURL+"/api/edge/check", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("edge request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	start := time.Now()
	resp, err := e.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("edge call: %w", err)
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	var result EdgeResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("edge response: %w", err)
	}
	result.Elapsed = time.Since(start)
	return &result, nil
}
