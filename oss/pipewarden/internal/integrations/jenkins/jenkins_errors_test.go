package jenkins

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// withMockJenkinsServer returns a client wired to a test http server.
func withMockJenkinsServer(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return NewClient(Config{Username: "u", APIToken: "t", BaseURL: srv.URL}, newTestLogger())
}

func TestTriggerPipelineNon200(t *testing.T) {
	c := withMockJenkinsServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte("nope"))
	})
	if _, err := c.TriggerPipeline(context.Background(), "job", "repo", "wf", "main"); err == nil {
		t.Fatal("expected 403 error")
	}
}

func TestTriggerPipelineHappy(t *testing.T) {
	c := withMockJenkinsServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	})
	run, err := c.TriggerPipeline(context.Background(), "job", "repo", "wf", "main")
	if err != nil {
		t.Fatalf("trigger: %v", err)
	}
	if run.Branch != "main" {
		t.Fatalf("branch: %q", run.Branch)
	}
}

func TestListPipelinesError(t *testing.T) {
	c := withMockJenkinsServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	if _, err := c.ListPipelines(context.Background(), "j", "r"); err == nil {
		t.Fatal("expected 500 error")
	}
}

func TestListPipelineRunsError(t *testing.T) {
	c := withMockJenkinsServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})
	if _, err := c.ListPipelineRuns(context.Background(), "j", "r", 10); err == nil {
		t.Fatal("expected 401 error")
	}
}

func TestGetPipelineRunError(t *testing.T) {
	c := withMockJenkinsServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	if _, err := c.GetPipelineRun(context.Background(), "j", "r", "1"); err == nil {
		t.Fatal("expected 404 error")
	}
}

func TestDoRequestBadBaseURL(t *testing.T) {
	c := NewClient(Config{Username: "u", APIToken: "t", BaseURL: "http://127.0.0.1:1"}, newTestLogger())
	_, err := c.ListPipelines(context.Background(), "j", "r")
	if err == nil {
		t.Fatal("expected dial error on unreachable port")
	}
}
