package circleci

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

func newTestLogger() *logging.Logger {
	cfg := &config.LoggingConfig{Level: "info", JSON: true}
	logger, _ := logging.New(cfg)
	return logger
}

func TestName(t *testing.T) {
	client := NewClient(Config{Token: "test"}, newTestLogger())
	if client.Name() != integrations.PlatformCircleCI {
		t.Errorf("expected %s, got %s", integrations.PlatformCircleCI, client.Name())
	}
}

func TestTestConnection_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/me" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("Circle-Token") != "test-token" {
			t.Errorf("unexpected token header: %s", r.Header.Get("Circle-Token"))
		}
		_ = json.NewEncoder(w).Encode(ccUser{ID: "1", Name: "testuser"})
	}))
	defer server.Close()

	client := NewClient(Config{Token: "test-token", BaseURL: server.URL}, newTestLogger())
	status, err := client.TestConnection(context.Background())

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !status.Connected {
		t.Error("expected connected to be true")
	}
	if status.User != "testuser" {
		t.Errorf("expected user testuser, got %s", status.User)
	}
	if status.Platform != integrations.PlatformCircleCI {
		t.Errorf("expected platform circleci, got %s", status.Platform)
	}
}

func TestTestConnection_AuthFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"Invalid token"}`))
	}))
	defer server.Close()

	client := NewClient(Config{Token: "bad-token", BaseURL: server.URL}, newTestLogger())
	status, err := client.TestConnection(context.Background())

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if status.Connected {
		t.Error("expected connected to be false")
	}
}

func TestListPipelines(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/project/gh/owner/repo/pipeline" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(ccPipelinesResponse{
			Items: []ccPipeline{
				{ID: "abc123", Number: 1, State: "success"},
				{ID: "def456", Number: 2, State: "running"},
			},
		})
	}))
	defer server.Close()

	client := NewClient(Config{Token: "token", BaseURL: server.URL}, newTestLogger())
	pipelines, err := client.ListPipelines(context.Background(), "owner", "repo")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pipelines) != 2 {
		t.Fatalf("expected 2 pipelines, got %d", len(pipelines))
	}
	if pipelines[0].Platform != integrations.PlatformCircleCI {
		t.Errorf("expected platform circleci, got %s", pipelines[0].Platform)
	}
	if pipelines[0].Repository != "owner/repo" {
		t.Errorf("expected owner/repo, got %s", pipelines[0].Repository)
	}
}

func TestGetPipelineRun(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/project/gh/owner/repo/pipeline/abc123" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(ccPipeline{
			ID:     "abc123",
			Number: 1,
			State:  "success",
			VCS:    ccVCS{Branch: "main", SHA: "deadbeef"},
		})
	}))
	defer server.Close()

	client := NewClient(Config{Token: "token", BaseURL: server.URL}, newTestLogger())
	run, err := client.GetPipelineRun(context.Background(), "owner", "repo", "abc123")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if run.ID != "abc123" {
		t.Errorf("expected ID abc123, got %s", run.ID)
	}
	if run.Status != integrations.StatusSuccess {
		t.Errorf("expected success, got %s", run.Status)
	}
	if run.Branch != "main" {
		t.Errorf("expected main, got %s", run.Branch)
	}
	if run.CommitSHA != "deadbeef" {
		t.Errorf("expected deadbeef, got %s", run.CommitSHA)
	}
}

func TestListPipelineRuns(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(ccPipelinesResponse{
			Items: []ccPipeline{
				{ID: "run1", Number: 1, State: "running", VCS: ccVCS{Branch: "main"}},
			},
		})
	}))
	defer server.Close()

	client := NewClient(Config{Token: "token", BaseURL: server.URL}, newTestLogger())
	runs, err := client.ListPipelineRuns(context.Background(), "owner", "repo", 10)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(runs) != 1 {
		t.Fatalf("expected 1 run, got %d", len(runs))
	}
	if runs[0].Status != integrations.StatusRunning {
		t.Errorf("expected running, got %s", runs[0].Status)
	}
}

func TestTriggerPipeline(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/project/gh/owner/repo/pipeline" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(ccPipeline{
			ID:    "new-run",
			State: "pending",
			VCS:   ccVCS{Branch: "main"},
		})
	}))
	defer server.Close()

	client := NewClient(Config{Token: "token", BaseURL: server.URL}, newTestLogger())
	run, err := client.TriggerPipeline(context.Background(), "owner", "repo", "workflow", "main")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if run.Status != integrations.StatusPending {
		t.Errorf("expected pending, got %s", run.Status)
	}
}

func TestMapCircleCIStatus(t *testing.T) {
	tests := []struct {
		state    string
		expected integrations.PipelineStatus
	}{
		{"pending", integrations.StatusPending},
		{"running", integrations.StatusRunning},
		{"success", integrations.StatusSuccess},
		{"failed", integrations.StatusFailed},
		{"canceled", integrations.StatusCancelled},
		{"unknown", integrations.StatusUnknown},
	}

	for _, tt := range tests {
		result := mapCircleCIStatus(tt.state)
		if result != tt.expected {
			t.Errorf("mapCircleCIStatus(%q) = %s, want %s", tt.state, result, tt.expected)
		}
	}
}

func TestAPIErrorHandling(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := NewClient(Config{Token: "token", BaseURL: server.URL}, newTestLogger())

	_, err := client.ListPipelines(context.Background(), "owner", "repo")
	if err == nil {
		t.Error("expected error for 404 response")
	}

	_, err = client.GetPipelineRun(context.Background(), "owner", "repo", "999")
	if err == nil {
		t.Error("expected error for 404 response")
	}

	_, err = client.ListPipelineRuns(context.Background(), "owner", "repo", 10)
	if err == nil {
		t.Error("expected error for 404 response")
	}
}

func TestDefaultBaseURL(t *testing.T) {
	client := NewClient(Config{Token: "token"}, newTestLogger())
	if client.config.BaseURL != "https://api.circleci.com/v2" {
		t.Errorf("expected default base URL, got %s", client.config.BaseURL)
	}
}

func TestBaseURLTrailingSlash(t *testing.T) {
	client := NewClient(Config{Token: "token", BaseURL: "https://api.circleci.com/v2/"}, newTestLogger())
	if client.config.BaseURL != "https://api.circleci.com/v2" {
		t.Errorf("expected trimmed URL, got %s", client.config.BaseURL)
	}
}
