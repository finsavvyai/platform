package azure

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

func newTestLogger() *logging.Logger {
	cfg := &config.LoggingConfig{Level: "info", JSON: true}
	logger, _ := logging.New(cfg)
	return logger
}

func newTestClient(serverURL, token string) *Client {
	return NewClient(Config{
		Organization: "myorg",
		Project:      "myproject",
		Token:        token,
		BaseURL:      serverURL,
	}, newTestLogger())
}

func TestName(t *testing.T) {
	client := NewClient(Config{Organization: "myorg", Project: "myproject", Token: "token"}, newTestLogger())
	if client.Name() != integrations.PlatformAzureDevOps {
		t.Errorf("expected %s, got %s", integrations.PlatformAzureDevOps, client.Name())
	}
}

func TestTestConnection_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/myorg/_apis/projects" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") == "" {
			t.Error("expected Authorization header")
		}
		_ = json.NewEncoder(w).Encode(projectsResponse{
			Count: 3,
			Value: []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			}{
				{ID: "proj1", Name: "Project1"},
				{ID: "proj2", Name: "Project2"},
				{ID: "proj3", Name: "Project3"},
			},
		})
	}))
	defer server.Close()

	// Intercept requests to modify the base URL
	client := newTestClient(server.URL, "test-token")

	status, err := client.TestConnection(context.Background())

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !status.Connected {
		t.Error("expected connected to be true")
	}
	if status.User != "myorg" {
		t.Errorf("expected user myorg, got %s", status.User)
	}
	if status.Platform != integrations.PlatformAzureDevOps {
		t.Errorf("expected platform azure_devops, got %s", status.Platform)
	}
}

func TestTestConnection_AuthFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"message":"Invalid personal access token."}`))
	}))
	defer server.Close()

	client := newTestClient(server.URL, "bad-token")

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
		if r.URL.Path != "/myorg/myproject/_apis/pipelines" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(pipelinesResponse{
			Count: 2,
			Value: []struct {
				ID   int    `json:"id"`
				Name string `json:"name"`
				URL  string `json:"url"`
			}{
				{ID: 1, Name: "Build-Pipeline", URL: "https://dev.azure.com/myorg/myproject/_build/definition?definitionId=1"},
				{ID: 2, Name: "Deploy-Pipeline", URL: "https://dev.azure.com/myorg/myproject/_build/definition?definitionId=2"},
			},
		})
	}))
	defer server.Close()

	client := newTestClient(server.URL, "token")

	pipelines, err := client.ListPipelines(context.Background(), "", "")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pipelines) != 2 {
		t.Fatalf("expected 2 pipelines, got %d", len(pipelines))
	}
	if pipelines[0].Name != "Build-Pipeline" {
		t.Errorf("expected Build-Pipeline, got %s", pipelines[0].Name)
	}
	if pipelines[0].Platform != integrations.PlatformAzureDevOps {
		t.Errorf("expected platform azure_devops, got %s", pipelines[0].Platform)
	}
}

func TestGetPipelineRun(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/myorg/myproject/_apis/pipelines/1/runs/456" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		now := time.Now()
		_ = json.NewEncoder(w).Encode(pipelineRun{
			ID:           456,
			Name:         "Build-Pipeline.456",
			State:        "completed",
			Result:       "succeeded",
			CreatedDate:  now.Add(-5 * time.Minute),
			FinishedDate: now,
			URL:          "https://dev.azure.com/myorg/myproject/_build/results?buildId=456",
		})
	}))
	defer server.Close()

	client := newTestClient(server.URL, "token")

	run, err := client.GetPipelineRun(context.Background(), "1", "", "456")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if run.ID != "456" {
		t.Errorf("expected ID 456, got %s", run.ID)
	}
	if run.Status != integrations.StatusSuccess {
		t.Errorf("expected success, got %s", run.Status)
	}
}

func TestListPipelineRuns(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/myorg/myproject/_apis/pipelines/1/runs" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		now := time.Now()
		_ = json.NewEncoder(w).Encode(runsResponse{
			Count: 2,
			Value: []pipelineRun{
				{
					ID:           100,
					Name:         "Build-Pipeline.100",
					State:        "completed",
					Result:       "succeeded",
					CreatedDate:  now.Add(-10 * time.Minute),
					FinishedDate: now.Add(-5 * time.Minute),
					URL:          "https://dev.azure.com/myorg/myproject/_build/results?buildId=100",
				},
				{
					ID:           99,
					Name:         "Build-Pipeline.99",
					State:        "completed",
					Result:       "failed",
					CreatedDate:  now.Add(-20 * time.Minute),
					FinishedDate: now.Add(-10 * time.Minute),
					URL:          "https://dev.azure.com/myorg/myproject/_build/results?buildId=99",
				},
			},
		})
	}))
	defer server.Close()

	client := newTestClient(server.URL, "token")

	runs, err := client.ListPipelineRuns(context.Background(), "1", "", 10)

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
		if r.URL.Path != "/myorg/myproject/_apis/pipelines/1/runs" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		now := time.Now()
		_ = json.NewEncoder(w).Encode(pipelineRun{
			ID:           200,
			Name:         "Build-Pipeline.200",
			State:        "notStarted",
			Result:       "",
			CreatedDate:  now,
			FinishedDate: time.Time{},
			URL:          "https://dev.azure.com/myorg/myproject/_build/results?buildId=200",
		})
	}))
	defer server.Close()

	client := newTestClient(server.URL, "token")

	run, err := client.TriggerPipeline(context.Background(), "1", "", "", "main")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if run.Status != integrations.StatusPending {
		t.Errorf("expected pending, got %s", run.Status)
	}
}

func TestMapAzureStatus(t *testing.T) {
	tests := []struct {
		state    string
		result   string
		expected integrations.PipelineStatus
	}{
		{"inProgress", "", integrations.StatusRunning},
		{"completed", "succeeded", integrations.StatusSuccess},
		{"completed", "failed", integrations.StatusFailed},
		{"completed", "canceled", integrations.StatusCancelled},
		{"notStarted", "", integrations.StatusPending},
		{"completed", "unknown", integrations.StatusUnknown},
		{"unknown", "", integrations.StatusUnknown},
	}

	for _, tt := range tests {
		result := mapAzureStatus(tt.state, tt.result)
		if result != tt.expected {
			t.Errorf("mapAzureStatus(%q, %q) = %s, want %s", tt.state, tt.result, result, tt.expected)
		}
	}
}

func TestAPIErrorHandling(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := newTestClient(server.URL, "token")

	_, err := client.GetPipelineRun(context.Background(), "1", "", "999")
	if err == nil {
		t.Error("expected error for 404 response")
	}

	_, err = client.ListPipelineRuns(context.Background(), "1", "", 10)
	if err == nil {
		t.Error("expected error for 404 response")
	}
}
