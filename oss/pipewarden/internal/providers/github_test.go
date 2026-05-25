package providers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGitHubName(t *testing.T) {
	p := NewGitHub(Config{Token: "test"})

	if p.Name() != "github" {
		t.Errorf("expected 'github', got %s", p.Name())
	}
}

func TestGitHubTestConnectionValid(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	p := NewGitHub(Config{Token: "test", BaseURL: server.URL})
	p.cli = server.Client()

	err := p.TestConnection(context.Background())

	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestGitHubTestConnectionMissingToken(t *testing.T) {
	p := NewGitHub(Config{Token: ""})

	err := p.TestConnection(context.Background())

	if err == nil {
		t.Error("expected error for missing token")
	}
}

func TestGitHubTestConnectionFailed(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	p := NewGitHub(Config{Token: "invalid", BaseURL: server.URL})
	p.cli = server.Client()

	err := p.TestConnection(context.Background())

	if err == nil {
		t.Error("expected error for failed connection")
	}
}

func TestGitHubGetLogs(t *testing.T) {
	p := NewGitHub(Config{Token: "test"})

	logs, err := p.GetLogs(context.Background(), "job")

	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	if len(logs) != 0 {
		t.Errorf("expected no logs, got %d", len(logs))
	}
}
