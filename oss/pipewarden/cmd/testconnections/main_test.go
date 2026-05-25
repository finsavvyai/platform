package main

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

func newLogger(t *testing.T) *logging.Logger {
	t.Helper()
	l, err := logging.New(&config.LoggingConfig{Level: "error", JSON: false})
	if err != nil {
		t.Fatalf("logger: %v", err)
	}
	return l
}

func TestEnvOrDefault(t *testing.T) {
	t.Setenv("PIPEWARDEN_TEST_ENV_VAR", "")
	if got := envOrDefault("PIPEWARDEN_TEST_ENV_VAR", "fallback"); got != "fallback" {
		t.Fatalf("fallback: %q", got)
	}
	t.Setenv("PIPEWARDEN_TEST_ENV_VAR", "set-value")
	if got := envOrDefault("PIPEWARDEN_TEST_ENV_VAR", "fallback"); got != "set-value" {
		t.Fatalf("env: %q", got)
	}
}

func TestAddGitHubConnectionsNoEnv(t *testing.T) {
	for _, k := range []string{"GITHUB_TOKEN", "GITHUB_TOKEN_2", "GITHUB_TOKEN_3"} {
		t.Setenv(k, "")
	}
	m := integrations.NewManager(newLogger(t))
	addGitHubConnections(m, newLogger(t))
	if m.Count() != 0 {
		t.Fatalf("expected zero conns, got %d", m.Count())
	}
}

func TestAddGitHubConnectionsSingleAndNumbered(t *testing.T) {
	t.Setenv("GITHUB_TOKEN", "ghp_main")
	t.Setenv("GITHUB_NAME", "main-org")
	t.Setenv("GITHUB_TOKEN_2", "ghp_extra")
	t.Setenv("GITHUB_NAME_2", "extra-org")
	t.Setenv("GITHUB_BASE_URL_2", "https://github.example.com/api/v3")
	t.Setenv("GITHUB_TOKEN_3", "") // skipped

	m := integrations.NewManager(newLogger(t))
	addGitHubConnections(m, newLogger(t))
	if m.Count() != 2 {
		t.Fatalf("expected 2 conns, got %d", m.Count())
	}
}

func TestAddBitbucketConnectionsRequiresBoth(t *testing.T) {
	t.Setenv("BITBUCKET_USERNAME", "user")
	t.Setenv("BITBUCKET_APP_PASSWORD", "") // missing
	m := integrations.NewManager(newLogger(t))
	addBitbucketConnections(m, newLogger(t))
	if m.Count() != 0 {
		t.Fatalf("missing pass: %d", m.Count())
	}

	t.Setenv("BITBUCKET_APP_PASSWORD", "pw")
	m2 := integrations.NewManager(newLogger(t))
	addBitbucketConnections(m2, newLogger(t))
	if m2.Count() != 1 {
		t.Fatalf("both set: %d", m2.Count())
	}
}

func TestAddBitbucketConnectionsNumbered(t *testing.T) {
	t.Setenv("BITBUCKET_USERNAME", "")
	t.Setenv("BITBUCKET_APP_PASSWORD", "")
	t.Setenv("BITBUCKET_USERNAME_2", "u2")
	t.Setenv("BITBUCKET_APP_PASSWORD_2", "p2")
	t.Setenv("BITBUCKET_NAME_2", "bb-team")
	t.Setenv("BITBUCKET_USERNAME_3", "u3")
	t.Setenv("BITBUCKET_APP_PASSWORD_3", "") // skipped

	m := integrations.NewManager(newLogger(t))
	addBitbucketConnections(m, newLogger(t))
	if m.Count() != 1 {
		t.Fatalf("numbered: %d", m.Count())
	}
}

func TestAddGitLabConnections(t *testing.T) {
	t.Setenv("GITLAB_TOKEN", "glpat-main")
	t.Setenv("GITLAB_TOKEN_2", "glpat-self")
	t.Setenv("GITLAB_BASE_URL_2", "https://gitlab.internal/api/v4")
	t.Setenv("GITLAB_TOKEN_3", "")

	m := integrations.NewManager(newLogger(t))
	addGitLabConnections(m, newLogger(t))
	if m.Count() != 2 {
		t.Fatalf("gitlab: %d", m.Count())
	}
}

func TestPrintUsage(t *testing.T) {
	origStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w
	done := make(chan struct{})
	var buf bytes.Buffer
	go func() {
		_, _ = io.Copy(&buf, r)
		close(done)
	}()
	printUsage()
	_ = w.Close()
	os.Stdout = origStdout
	<-done

	out := buf.String()
	for _, want := range []string{"PipeWarden Connection Tester", "GITHUB_TOKEN", "BITBUCKET_USERNAME", "GITLAB_TOKEN"} {
		if !strings.Contains(out, want) {
			t.Fatalf("usage missing %q\n--- output ---\n%s", want, out)
		}
	}
}
