package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// githubAPIBase is the GitHub REST API root. Override in tests via setGithubAPIBase.
var githubAPIBase = "https://api.github.com"

// setGithubAPIBase replaces the API base URL; intended for tests only.
func setGithubAPIBase(base string) { githubAPIBase = base }

// createGitHubBranch creates a new branch from the given baseSHA.
func createGitHubBranch(owner, repo, branch, baseSHA, token string) error {
	url := fmt.Sprintf("%s/repos/%s/%s/git/refs", githubAPIBase, owner, repo)
	payload := map[string]string{
		"ref": "refs/heads/" + branch,
		"sha": baseSHA,
	}
	return githubPost(url, payload, token, http.StatusCreated)
}

// getRepoDefaultBranch returns the resolved branch name and its latest commit SHA.
// If baseBranch is empty the repo's default branch is used.
func getRepoDefaultBranch(owner, repo, baseBranch, token string) (string, string, error) {
	if baseBranch == "" {
		baseBranch = "main"
	}

	url := fmt.Sprintf("%s/repos/%s/%s/git/refs/heads/%s", githubAPIBase, owner, repo, baseBranch)
	body, err := githubGet(url, token)
	if err != nil {
		return "", "", fmt.Errorf("get ref %s: %w", baseBranch, err)
	}

	var ref struct {
		Object struct {
			SHA string `json:"sha"`
		} `json:"object"`
	}
	if err := json.Unmarshal(body, &ref); err != nil {
		return "", "", fmt.Errorf("parse ref response: %w", err)
	}
	if ref.Object.SHA == "" {
		return "", "", fmt.Errorf("empty SHA for branch %s", baseBranch)
	}
	return baseBranch, ref.Object.SHA, nil
}

// createGitHubPR opens a pull request and returns the PR number and URL.
func createGitHubPR(owner, repo, title, body, head, base, token string) (int, string, error) {
	url := fmt.Sprintf("%s/repos/%s/%s/pulls", githubAPIBase, owner, repo)
	payload := map[string]string{
		"title": title,
		"body":  body,
		"head":  head,
		"base":  base,
	}

	respBody, err := githubPostRaw(url, payload, token, http.StatusCreated)
	if err != nil {
		return 0, "", err
	}

	var pr struct {
		Number  int    `json:"number"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.Unmarshal(respBody, &pr); err != nil {
		return 0, "", fmt.Errorf("parse PR response: %w", err)
	}
	return pr.Number, pr.HTMLURL, nil
}

// ensureDependabotConfig commits a .github/dependabot.yml enabling GitHub
// Actions version updates on the given branch (best-effort, error is advisory).
func ensureDependabotConfig(owner, repo, branch, token string) error {
	checkURL := fmt.Sprintf("%s/repos/%s/%s/contents/.github/dependabot.yml?ref=%s",
		githubAPIBase, owner, repo, branch)
	_, err := githubGet(checkURL, token)
	if err == nil {
		return nil // already exists
	}

	content := "dmVyc2lvbjogMgp1cGRhdGVzOgogIC0gcGFja2FnZS1lY29zeXN0ZW06ICJnaXRodWItYWN0aW9ucyIKICAgIGRpcmVjdG9yeTogIi8iCiAgICBzY2hlZHVsZToKICAgICAgaW50ZXJ2YWw6ICJ3ZWVrbHkiCg=="
	putURL := fmt.Sprintf("%s/repos/%s/%s/contents/.github/dependabot.yml", githubAPIBase, owner, repo)
	payload := map[string]string{
		"message": "[PipeWarden] Add Dependabot config for GitHub Actions auto-updates",
		"content": content,
		"branch":  branch,
	}
	return githubPost(putURL, payload, token, http.StatusCreated)
}

// githubGet performs an authenticated GET and returns the response body.
func githubGet(url, token string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	setGitHubHeaders(req, token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("GitHub API %s: %s", resp.Status, truncate(string(body), 120))
	}
	return body, nil
}

// githubPost performs an authenticated POST, returning an error on unexpected status.
func githubPost(url string, payload interface{}, token string, wantStatus int) error {
	_, err := githubPostRaw(url, payload, token, wantStatus)
	return err
}

// githubPostRaw performs an authenticated POST and returns the raw response body.
func githubPostRaw(url string, payload interface{}, token string, wantStatus int) ([]byte, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	setGitHubHeaders(req, token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != wantStatus {
		return nil, fmt.Errorf("GitHub API %s: %s", resp.Status, truncate(string(body), 120))
	}
	return body, nil
}

func setGitHubHeaders(req *http.Request, token string) {
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Content-Type", "application/json")
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
