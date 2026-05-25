package jenkins

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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
	client := NewClient(Config{BaseURL: "http://localhost:8080", Username: "user", APIToken: "token"}, newTestLogger())
	if client.Name() != integrations.PlatformJenkins {
		t.Errorf("expected %s, got %s", integrations.PlatformJenkins, client.Name())
	}
}

func TestTestConnection_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/json" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") == "" {
			t.Error("expected Authorization header")
		}
		_ = json.NewEncoder(w).Encode(jenkinsServer{Version: "2.387.1"})
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Username: "admin", APIToken: "test-token"}, newTestLogger())
	status, err := client.TestConnection(context.Background())

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !status.Connected {
		t.Error("expected connected to be true")
	}
	if status.User != "admin" {
		t.Errorf("expected user admin, got %s", status.User)
	}
	if status.Platform != integrations.PlatformJenkins {
		t.Errorf("expected platform jenkins, got %s", status.Platform)
	}
}

func TestTestConnection_AuthFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"_class":"hudson.security.AccessDeniedException"}`))
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Username: "bad", APIToken: "bad"}, newTestLogger())
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
		if r.URL.Path != "/api/json" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(jenkinsJobsResponse{
			Jobs: []jenkinsJob{
				{Name: "build-app", URL: "http://localhost:8080/job/build-app/", Color: "blue"},
				{Name: "deploy-prod", URL: "http://localhost:8080/job/deploy-prod/", Color: "notbuilt"},
			},
		})
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Username: "user", APIToken: "token"}, newTestLogger())
	pipelines, err := client.ListPipelines(context.Background(), "", "")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pipelines) != 2 {
		t.Fatalf("expected 2 pipelines, got %d", len(pipelines))
	}
	if pipelines[0].Name != "build-app" {
		t.Errorf("expected build-app, got %s", pipelines[0].Name)
	}
	if pipelines[0].Platform != integrations.PlatformJenkins {
		t.Errorf("expected platform jenkins, got %s", pipelines[0].Platform)
	}
}

func TestGetPipelineRun(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/job/build-app/123/api/json" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(jenkinsBuild{
			Number:    123,
			Result:    "SUCCESS",
			Timestamp: 1704067200000,
			Duration:  300000,
			URL:       "http://localhost:8080/job/build-app/123/",
			Building:  false,
		})
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Username: "user", APIToken: "token"}, newTestLogger())
	run, err := client.GetPipelineRun(context.Background(), "build-app", "", "123")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if run.ID != "123" {
		t.Errorf("expected ID 123, got %s", run.ID)
	}
	if run.Status != integrations.StatusSuccess {
		t.Errorf("expected success, got %s", run.Status)
	}
}

func TestListPipelineRuns(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/job/build-app/api/json" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(jenkinsJobResponse{
			Name: "build-app",
			Builds: []jenkinsBuild{
				{Number: 100, Result: "SUCCESS", Timestamp: 1704067200000, Duration: 300000, URL: "http://localhost:8080/job/build-app/100/"},
				{Number: 99, Result: "FAILURE", Timestamp: 1704063600000, Duration: 250000, URL: "http://localhost:8080/job/build-app/99/"},
			},
		})
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Username: "user", APIToken: "token"}, newTestLogger())
	runs, err := client.ListPipelineRuns(context.Background(), "build-app", "", 10)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(runs) != 2 {
		t.Fatalf("expected 2 runs, got %d", len(runs))
	}
	if runs[0].Status != integrations.StatusSuccess {
		t.Errorf("expected success, got %s", runs[0].Status)
	}
	if runs[1].Status != integrations.StatusFailed {
		t.Errorf("expected failed, got %s", runs[1].Status)
	}
}

func TestTriggerPipeline(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/job/build-app/build" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Username: "user", APIToken: "token"}, newTestLogger())
	run, err := client.TriggerPipeline(context.Background(), "build-app", "", "", "main")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if run.Status != integrations.StatusPending {
		t.Errorf("expected pending, got %s", run.Status)
	}
	if run.Branch != "main" {
		t.Errorf("expected branch main, got %s", run.Branch)
	}
}

func TestMapJenkinsStatus(t *testing.T) {
	tests := []struct {
		result   string
		building bool
		expected integrations.PipelineStatus
	}{
		{"SUCCESS", false, integrations.StatusSuccess},
		{"FAILURE", false, integrations.StatusFailed},
		{"ABORTED", false, integrations.StatusCancelled},
		{"NOT_BUILT", false, integrations.StatusPending},
		{"SUCCESS", true, integrations.StatusRunning},
		{"", false, integrations.StatusUnknown},
	}

	for _, tt := range tests {
		result := mapJenkinsStatus(tt.result, tt.building)
		if result != tt.expected {
			t.Errorf("mapJenkinsStatus(%q, %v) = %s, want %s", tt.result, tt.building, result, tt.expected)
		}
	}
}

func TestAPIErrorHandling(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := NewClient(Config{BaseURL: server.URL, Username: "user", APIToken: "token"}, newTestLogger())

	_, err := client.GetPipelineRun(context.Background(), "nonexistent", "", "123")
	if err == nil {
		t.Error("expected error for 404 response")
	}

	_, err = client.ListPipelineRuns(context.Background(), "nonexistent", "", 10)
	if err == nil {
		t.Error("expected error for 404 response")
	}
}

func TestBaseURLTrailingSlash(t *testing.T) {
	client := NewClient(Config{BaseURL: "http://localhost:8080/", Username: "user", APIToken: "token"}, newTestLogger())
	if strings.HasSuffix(client.config.BaseURL, "/") {
		t.Errorf("expected trimmed URL, got %s", client.config.BaseURL)
	}
}
