package bitbucket

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func withMockServer(t *testing.T, h http.HandlerFunc) *Client {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return NewClient(Config{Username: "u", AppPassword: "p", BaseURL: srv.URL}, newTestLogger())
}

func TestTriggerPipelineError(t *testing.T) {
	c := withMockServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	})
	if _, err := c.TriggerPipeline(context.Background(), "ws", "repo", "", "main"); err == nil {
		t.Fatal("expected 403 error")
	}
}

func TestListPipelinesError(t *testing.T) {
	c := withMockServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	if _, err := c.ListPipelines(context.Background(), "ws", "repo"); err == nil {
		t.Fatal("expected 500 error")
	}
}

func TestGetPipelineRunError(t *testing.T) {
	c := withMockServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	if _, err := c.GetPipelineRun(context.Background(), "ws", "repo", "1"); err == nil {
		t.Fatal("expected 404 error")
	}
}

func TestListPipelineRunsError(t *testing.T) {
	c := withMockServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})
	if _, err := c.ListPipelineRuns(context.Background(), "ws", "repo", 10); err == nil {
		t.Fatal("expected 401 error")
	}
}
