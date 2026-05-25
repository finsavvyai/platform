package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
)

// watchPollInterval is how often we re-check run status. Five seconds
// matches the brief's --watch cadence and stays well under GitHub's
// 5000 req/hr REST rate limit even with many concurrent watches.
var watchPollInterval = 5 * time.Second

// cmdTriggerWatch resolves the numeric run ID and streams status.
// Exposed as a subcommand so users can reattach to a run they kicked
// off earlier from another terminal.
func cmdTriggerWatch(ctx context.Context, runIDStr string) error {
	id, err := strconv.ParseInt(runIDStr, 10, 64)
	if err != nil {
		return fmt.Errorf("run ID must be numeric: %w", err)
	}
	client, owner, repo, err := newTriggerClient()
	if err != nil {
		return err
	}
	cli.Header(fmt.Sprintf("Watching run %d", id))
	return watchRun(ctx, client, owner, repo, id)
}

// watchRun polls a run every watchPollInterval until it reaches a
// terminal state. We return nil on success and an error on failure
// so callers can exit-code appropriately for CI integration.
func watchRun(ctx context.Context, client *triggerClient, owner, repo string, id int64) error {
	var last string
	for {
		run, err := client.getRun(ctx, owner, repo, id)
		if err != nil {
			return err
		}
		if run.Status != last {
			cli.Info(fmt.Sprintf("status: %s", run.Status))
			last = run.Status
		}
		if run.Status == "completed" {
			if run.Conclusion == "success" {
				cli.Success(fmt.Sprintf("Run #%d succeeded: %s", run.RunNumber, run.HTMLURL))
				return nil
			}
			return fmt.Errorf("run #%d %s: %s", run.RunNumber, run.Conclusion, run.HTMLURL)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(watchPollInterval):
		}
	}
}

// detectToken resolves the GitHub token in priority order:
//  1. GITHUB_TOKEN env var (the canonical override)
//  2. `gh auth token` (most dev machines have gh installed)
//  3. ~/.config/pushci/credentials.json { "github_token": "…" }
//
// Keeping this in one place means the trigger command doesn't have to
// replicate auth logic from cmd_login.go, and enterprises can wire in
// their own token via the credentials.json file without env exports.
func detectToken() (string, error) {
	if t := strings.TrimSpace(os.Getenv("GITHUB_TOKEN")); t != "" {
		return t, nil
	}
	if out, err := exec.Command("gh", "auth", "token").Output(); err == nil {
		if t := strings.TrimSpace(string(out)); t != "" {
			return t, nil
		}
	}
	home, err := os.UserHomeDir()
	if err == nil {
		path := filepath.Join(home, ".config", "pushci", "credentials.json")
		if body, err := os.ReadFile(path); err == nil {
			var creds struct {
				GitHubToken string `json:"github_token"`
			}
			if json.Unmarshal(body, &creds) == nil && creds.GitHubToken != "" {
				return creds.GitHubToken, nil
			}
		}
	}
	return "", fmt.Errorf("no GitHub token found (set GITHUB_TOKEN, run `gh auth login`, or save ~/.config/pushci/credentials.json)")
}
