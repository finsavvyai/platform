package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

// defaultGitHubAPI is the canonical REST base. Overridden in tests.
var defaultGitHubAPI = "https://api.github.com"

// triggerClient wraps the stdlib http.Client with a GitHub token +
// base URL. Stdlib-only so we can drop it into a hermetic test
// without any extra dependencies.
type triggerClient struct {
	http  *http.Client
	token string
	base  string
}

type workflow struct {
	ID    int64  `json:"id"`
	Name  string `json:"name"`
	Path  string `json:"path"`
	State string `json:"state"`
}

type workflowRun struct {
	ID         int64  `json:"id"`
	RunNumber  int    `json:"run_number"`
	HTMLURL    string `json:"html_url"`
	Status     string `json:"status"`
	Conclusion string `json:"conclusion"`
}

// newTriggerClient builds a client with auto-detected owner/repo from
// `git remote get-url origin` and a token from env/gh/config.
func newTriggerClient() (*triggerClient, string, string, error) {
	owner, repo, err := detectRepo()
	if err != nil {
		return nil, "", "", err
	}
	token, err := detectToken()
	if err != nil {
		return nil, "", "", err
	}
	return &triggerClient{
		http:  &http.Client{Timeout: 15 * time.Second},
		token: token, base: defaultGitHubAPI,
	}, owner, repo, nil
}

// repoRegex matches both ssh and https GitHub remote formats.
var repoRegex = regexp.MustCompile(`github\.com[:/]([^/]+)/([^/.\s]+)`)

// detectRepo parses `git remote get-url origin` into owner/repo.
// Strips trailing .git. Invoked once at CLI entry; outside a git
// checkout the command fails fast with a clear error.
func detectRepo() (string, string, error) {
	out, err := exec.Command("git", "remote", "get-url", "origin").Output()
	if err != nil {
		return "", "", fmt.Errorf("git remote get-url origin: %w", err)
	}
	m := repoRegex.FindStringSubmatch(strings.TrimSpace(string(out)))
	if len(m) < 3 {
		return "", "", fmt.Errorf("could not parse GitHub remote: %s", out)
	}
	return m[1], strings.TrimSuffix(m[2], ".git"), nil
}

func (c *triggerClient) listWorkflows(ctx context.Context, owner, repo string) ([]workflow, error) {
	b, _, err := c.do(ctx, "GET", fmt.Sprintf("/repos/%s/%s/actions/workflows", owner, repo), nil)
	if err != nil {
		return nil, err
	}
	var out struct {
		Workflows []workflow `json:"workflows"`
	}
	return out.Workflows, json.Unmarshal(b, &out)
}

// dispatch POSTs workflow_dispatch. GitHub returns 204 on success.
// A 422 means the ref is invalid or the workflow has no
// `workflow_dispatch` trigger — both surface to the caller as-is.
func (c *triggerClient) dispatch(ctx context.Context, owner, repo, wf, ref string, inputs map[string]string) error {
	payload := map[string]interface{}{"ref": ref}
	if len(inputs) > 0 {
		payload["inputs"] = inputs
	}
	_, _, err := c.do(ctx, "POST",
		fmt.Sprintf("/repos/%s/%s/actions/workflows/%s/dispatches", owner, repo, wf),
		payload)
	return err
}
