package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"github.com/finsavvyai/pushci/internal/runner"
)

// reportRun sends run results to the PushCI dashboard API.
// Called automatically after pushci run. Fails silently.
func reportRun(run *runner.Run) {
	repo := gitRemoteRepo()
	if repo == "" {
		return
	}
	sha := gitHead()
	branch := currentBranch()
	msg := gitCommitMessage()
	status := "passed"
	if !run.Passed {
		status = "failed"
	}

	checks := make([]map[string]any, len(run.Results))
	for i, r := range run.Results {
		checks[i] = map[string]any{
			"check": r.Check, "passed": r.Passed,
			"duration": r.Duration.String(),
		}
	}

	artifacts := scanArtifacts(".")
	body, _ := json.Marshal(map[string]any{
		"repo": repo, "branch": branch, "sha": sha,
		"status": status, "duration_ms": run.Elapsed.Milliseconds(),
		"commit_message": msg, "checks": checks,
		"artifacts": artifacts,
	})

	go func() {
		client := &http.Client{Timeout: 5 * time.Second}
		req, _ := http.NewRequest("POST", apiBase+"/api/runs/report", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if token := loadAuthToken(); token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := client.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}()
}

func gitHead() string {
	out, err := exec.Command("git", "rev-parse", "HEAD").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func currentBranch() string {
	out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output()
	if err != nil {
		return "main"
	}
	return strings.TrimSpace(string(out))
}

func gitCommitMessage() string {
	out, err := exec.Command("git", "log", "-1", "--format=%s").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}
