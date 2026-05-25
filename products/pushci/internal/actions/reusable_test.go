package actions

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The tests below exercise reusable-workflow support WITHOUT requiring
// act or Docker. They validate that:
//   * RunOptions.LocalRepositories round-trips through to argv
//   * RunOptions.GitHubToken lands in the secret file, not the argv
//   * Validate() rejects obviously broken reusable config
//   * Local reusable callees/callers are discovered by DetectWorkflows
//
// End-to-end execution (which requires act + Docker + network for remote
// reusables) lives in reusable_integration_test.go behind the
// `integration` build tag.

func TestReusable_ValidateLocalRepositories(t *testing.T) {
	cases := []struct {
		name    string
		opts    RunOptions
		wantErr string
	}{
		{"empty value", RunOptions{LocalRepositories: map[string]string{"acme/shared@v1": ""}}, "empty"},
		{"empty key", RunOptions{LocalRepositories: map[string]string{"": "/tmp/x"}}, "empty"},
		{"key with whitespace", RunOptions{LocalRepositories: map[string]string{"acme shared@v1": "/tmp/x"}}, "whitespace"},
		{"token with whitespace", RunOptions{GitHubToken: "bad token"}, "whitespace"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.opts.Validate()
			if err == nil {
				t.Fatalf("expected validation error containing %q", tc.wantErr)
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error %q missing substring %q", err.Error(), tc.wantErr)
			}
		})
	}
}

func TestReusable_BuildArgsForwardsLocalRepository(t *testing.T) {
	opts := RunOptions{
		LocalRepositories: map[string]string{
			"acme/shared@v1":  "/fixtures/shared",
			"acme/library@v2": "/fixtures/library",
		},
	}
	args, cleanup, err := buildArgs(opts)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()

	joined := strings.Join(args, " ")
	for _, want := range []string{
		"--local-repository acme/shared@v1=/fixtures/shared",
		"--local-repository acme/library@v2=/fixtures/library",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("argv missing %q\n  argv: %s", want, joined)
		}
	}
}

func TestReusable_TokenLandsInSecretFileNotArgv(t *testing.T) {
	opts := RunOptions{GitHubToken: "ghp_AAAAAAAAAAAA1234"}
	args, cleanup, err := buildArgs(opts)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()

	// Token must never appear on the command line.
	for _, a := range args {
		if strings.Contains(a, "ghp_AAAAAAAAAAAA1234") {
			t.Fatalf("token leaked into argv: %v", args)
		}
	}
	// The --secret-file flag must be present and point at a file that
	// contains GITHUB_TOKEN=<token>.
	idx := indexOfFlag(args, "--secret-file")
	if idx < 0 || idx+1 >= len(args) {
		t.Fatalf("argv missing --secret-file flag: %v", args)
	}
	body, err := os.ReadFile(args[idx+1])
	if err != nil {
		t.Fatalf("read secret file: %v", err)
	}
	if !strings.Contains(string(body), "GITHUB_TOKEN=ghp_AAAAAAAAAAAA1234") {
		t.Fatalf("secret file missing GITHUB_TOKEN, got: %s", body)
	}
}

func TestReusable_ExplicitSecretWinsOverToken(t *testing.T) {
	opts := RunOptions{
		GitHubToken: "from-token-field",
		Secrets:     map[string]string{"GITHUB_TOKEN": "from-secrets-map"},
	}
	args, cleanup, err := buildArgs(opts)
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	idx := indexOfFlag(args, "--secret-file")
	body, _ := os.ReadFile(args[idx+1])
	if !strings.Contains(string(body), "GITHUB_TOKEN=from-secrets-map") {
		t.Fatalf("explicit Secrets entry should win, got: %s", body)
	}
	if strings.Contains(string(body), "from-token-field") {
		t.Fatalf("GitHubToken field should have been ignored, got: %s", body)
	}
}

func TestReusable_LocalCalleeDiscoveredByDetectWorkflows(t *testing.T) {
	repo := t.TempDir()
	wfDir := filepath.Join(repo, ".github", "workflows")
	if err := os.MkdirAll(wfDir, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, fixture := range []string{
		"06-reusable-local-caller.yml",
		"06-reusable-local-callee.yml",
	} {
		body, err := os.ReadFile(filepath.Join("testdata", "workflows", fixture))
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(wfDir, fixture), body, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	wfs, err := DetectWorkflows(repo)
	if err != nil {
		t.Fatal(err)
	}
	if len(wfs) != 2 {
		t.Fatalf("expected 2 workflows (caller + callee), got %d: %+v", len(wfs), wfs)
	}
	if !HasWorkflows(repo) {
		t.Fatal("HasWorkflows should be true when reusable workflows are present")
	}
}

// indexOfFlag returns the argv index of flag, or -1 if absent.
func indexOfFlag(argv []string, flag string) int {
	for i, a := range argv {
		if a == flag {
			return i
		}
	}
	return -1
}
