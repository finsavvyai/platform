package handlers

import (
	"testing"
	"time"
)

func TestValidateBatchRequest(t *testing.T) {
	cases := []struct {
		name    string
		req     BatchFixPRRequest
		wantErr bool
	}{
		{"empty ids", BatchFixPRRequest{GitHubToken: "t", Owner: "o", Repo: "r"}, true},
		{"over cap", BatchFixPRRequest{FindingIDs: makeIDs(25), GitHubToken: "t", Owner: "o", Repo: "r"}, true},
		{"missing token", BatchFixPRRequest{FindingIDs: []int64{1}, Owner: "o", Repo: "r"}, true},
		{"missing owner", BatchFixPRRequest{FindingIDs: []int64{1}, GitHubToken: "t", Repo: "r"}, true},
		{"missing repo", BatchFixPRRequest{FindingIDs: []int64{1}, GitHubToken: "t", Owner: "o"}, true},
		{"valid, defaults base branch", BatchFixPRRequest{FindingIDs: []int64{1, 2}, GitHubToken: "t", Owner: "o", Repo: "r"}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := validateBatchRequest(&c.req)
			if (err != nil) != c.wantErr {
				t.Errorf("got err=%v, wantErr=%v", err, c.wantErr)
			}
			if !c.wantErr && c.req.BaseBranch != "main" {
				t.Errorf("expected default base_branch=main, got %q", c.req.BaseBranch)
			}
		})
	}
}

func TestSummariseBatch(t *testing.T) {
	results := []BatchFixPRResult{
		{FindingID: 1, Status: "created"},
		{FindingID: 2, Status: "created"},
		{FindingID: 3, Status: "failed"},
		{FindingID: 4, Status: "skipped"},
	}
	resp := summariseBatch(results, 500*time.Millisecond)

	if resp.Requested != 4 {
		t.Errorf("requested=%d", resp.Requested)
	}
	if resp.Succeeded != 2 {
		t.Errorf("succeeded=%d", resp.Succeeded)
	}
	if resp.Failed != 1 {
		t.Errorf("failed=%d", resp.Failed)
	}
	if resp.Skipped != 1 {
		t.Errorf("skipped=%d", resp.Skipped)
	}
	if resp.TotalTime < 0.499 || resp.TotalTime > 0.501 {
		t.Errorf("total_time=%v", resp.TotalTime)
	}
}

func makeIDs(n int) []int64 {
	ids := make([]int64, n)
	for i := range ids {
		ids[i] = int64(i + 1)
	}
	return ids
}
