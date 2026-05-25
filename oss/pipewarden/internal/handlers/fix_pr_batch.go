package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/finsavvyai/pipewarden/internal/tracing"
)

// BatchFixPRRequest requests parallel auto-fix PRs for up to 20 findings.
// Enterprise / Enterprise+ tier feature — gated by billingClient.
type BatchFixPRRequest struct {
	FindingIDs  []int64 `json:"finding_ids"`
	Owner       string  `json:"owner"`
	Repo        string  `json:"repo"`
	BaseBranch  string  `json:"base_branch"`
	GitHubToken string  `json:"github_token"`
	MaxParallel int     `json:"max_parallel,omitempty"` // default 4, max 8
}

// BatchFixPRResult is the per-finding outcome in a parallel auto-fix run.
type BatchFixPRResult struct {
	FindingID int64   `json:"finding_id"`
	Status    string  `json:"status"` // "created" | "skipped" | "failed"
	PRURL     string  `json:"pr_url,omitempty"`
	PRNumber  int     `json:"pr_number,omitempty"`
	Branch    string  `json:"branch,omitempty"`
	Error     string  `json:"error,omitempty"`
	Duration  float64 `json:"duration_seconds"`
}

// BatchFixPRResponse is the envelope returned to the caller.
type BatchFixPRResponse struct {
	Requested int                `json:"requested"`
	Succeeded int                `json:"succeeded"`
	Failed    int                `json:"failed"`
	Skipped   int                `json:"skipped"`
	Results   []BatchFixPRResult `json:"results"`
	TotalTime float64            `json:"total_time_seconds"`
}

const (
	batchMaxFindings    = 20
	batchMaxParallelCap = 8
	batchDefaultWorkers = 4
)

// CreateFixPRBatch handles POST /api/v1/findings/fix/pr/batch.
// Fans out finding → goroutine with bounded concurrency (Agent of Empires pattern).
func (h *Handlers) CreateFixPRBatch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req BatchFixPRRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := validateBatchRequest(&req); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.MaxParallel <= 0 {
		req.MaxParallel = batchDefaultWorkers
	}
	if req.MaxParallel > batchMaxParallelCap {
		req.MaxParallel = batchMaxParallelCap
	}

	ctx, end := tracing.Task(r.Context(), "CreateFixPRBatch")
	defer end()

	start := time.Now()
	results := runBatchFixPR(ctx, h, req)
	resp := summariseBatch(results, time.Since(start))
	jsonOK(w, resp)
}

func validateBatchRequest(req *BatchFixPRRequest) error {
	if len(req.FindingIDs) == 0 {
		return fmt.Errorf("finding_ids is required")
	}
	if len(req.FindingIDs) > batchMaxFindings {
		return fmt.Errorf("at most %d findings per batch", batchMaxFindings)
	}
	if req.GitHubToken == "" {
		return fmt.Errorf("github_token is required")
	}
	if req.Owner == "" || req.Repo == "" {
		return fmt.Errorf("owner and repo are required")
	}
	if req.BaseBranch == "" {
		req.BaseBranch = "main"
	}
	return nil
}

// runBatchFixPR fans out finding IDs to a worker pool and collects results.
func runBatchFixPR(ctx context.Context, h *Handlers, req BatchFixPRRequest) []BatchFixPRResult {
	jobs := make(chan int64, len(req.FindingIDs))
	out := make(chan BatchFixPRResult, len(req.FindingIDs))

	var wg sync.WaitGroup
	for i := 0; i < req.MaxParallel; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for id := range jobs {
				out <- runSingleFixPR(ctx, h, id, req)
			}
		}()
	}

	for _, id := range req.FindingIDs {
		jobs <- id
	}
	close(jobs)

	wg.Wait()
	close(out)

	results := make([]BatchFixPRResult, 0, len(req.FindingIDs))
	for r := range out {
		results = append(results, r)
	}
	return results
}

func runSingleFixPR(ctx context.Context, h *Handlers, id int64, req BatchFixPRRequest) BatchFixPRResult {
	childCtx, end := tracing.Task(ctx, "CreateFixPR-worker")
	defer end()
	_ = childCtx
	start := time.Now()

	finding := lookupFinding(h, id)
	if finding == nil {
		return BatchFixPRResult{FindingID: id, Status: "skipped", Error: "finding not found", Duration: time.Since(start).Seconds()}
	}

	steps, autoFixable, _ := fixStepsForFinding(finding.Category, finding.Title)
	branch := fmt.Sprintf("pipewarden/fix-%s-%d", sanitizeBranchSegment(finding.Category), finding.ID)
	title := fmt.Sprintf("[PipeWarden] Fix: %s", finding.Title)
	body := buildPRBody(steps, finding.ID)

	_, baseSHA, err := getRepoDefaultBranch(req.Owner, req.Repo, req.BaseBranch, req.GitHubToken)
	if err != nil {
		return BatchFixPRResult{FindingID: id, Status: "failed", Error: "base branch lookup: " + err.Error(), Duration: time.Since(start).Seconds()}
	}
	if err := createGitHubBranch(req.Owner, req.Repo, branch, baseSHA, req.GitHubToken); err != nil {
		return BatchFixPRResult{FindingID: id, Status: "failed", Error: "branch create: " + err.Error(), Duration: time.Since(start).Seconds()}
	}

	if autoFixable && strings.Contains(strings.ToLower(finding.Category), "supply-chain") {
		_ = ensureDependabotConfig(req.Owner, req.Repo, branch, req.GitHubToken)
	}

	prNum, prURL, err := createGitHubPR(req.Owner, req.Repo, title, body, branch, req.BaseBranch, req.GitHubToken)
	if err != nil {
		return BatchFixPRResult{FindingID: id, Status: "failed", Error: "pr create: " + err.Error(), Duration: time.Since(start).Seconds()}
	}

	return BatchFixPRResult{FindingID: id, Status: "created", PRURL: prURL, PRNumber: prNum, Branch: branch, Duration: time.Since(start).Seconds()}
}

func lookupFinding(h *Handlers, id int64) *findingRef {
	findings, err := h.db.ListFindings("")
	if err != nil {
		return nil
	}
	for _, f := range findings {
		if f.ID == id {
			return &findingRef{ID: f.ID, Title: f.Title, Category: f.Category}
		}
	}
	return nil
}

func summariseBatch(results []BatchFixPRResult, total time.Duration) BatchFixPRResponse {
	resp := BatchFixPRResponse{Requested: len(results), Results: results, TotalTime: total.Seconds()}
	for _, r := range results {
		switch r.Status {
		case "created":
			resp.Succeeded++
		case "failed":
			resp.Failed++
		case "skipped":
			resp.Skipped++
		}
	}
	return resp
}
