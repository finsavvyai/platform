package demo

import (
	"context"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

func newClient(t *testing.T) *Client {
	return NewClient(integrations.PlatformGitHub, logging.NewDefault())
}

func TestNewClientDefaultsToGitHub(t *testing.T) {
	c := NewClient("", logging.NewDefault())
	if c.Name() != integrations.PlatformGitHub {
		t.Fatalf("Name=%q, want github", c.Name())
	}
}

func TestTestConnectionReportsConnected(t *testing.T) {
	c := newClient(t)
	st, err := c.TestConnection(context.Background())
	if err != nil {
		t.Fatalf("TestConnection: %v", err)
	}
	if !st.Connected {
		t.Fatalf("expected Connected=true")
	}
	if st.Latency <= 0 {
		t.Fatalf("expected positive latency")
	}
}

func TestListPipelinesAndRunsFillsRepo(t *testing.T) {
	c := newClient(t)
	pipelines, err := c.ListPipelines(context.Background(), "", "")
	if err != nil {
		t.Fatalf("ListPipelines: %v", err)
	}
	if len(pipelines) != 2 {
		t.Fatalf("pipelines len=%d, want 2", len(pipelines))
	}
	if pipelines[0].Repository != "demo-org/sample-app" {
		t.Fatalf("repo defaulting broken: %q", pipelines[0].Repository)
	}

	runs, err := c.ListPipelineRuns(context.Background(), "", "", 0)
	if err != nil {
		t.Fatalf("ListPipelineRuns: %v", err)
	}
	if len(runs) != 3 {
		t.Fatalf("runs len=%d, want 3", len(runs))
	}

	limited, _ := c.ListPipelineRuns(context.Background(), "x", "y", 1)
	if len(limited) != 1 {
		t.Fatalf("limit ignored: got %d", len(limited))
	}
}

func TestGetPipelineRunVariants(t *testing.T) {
	c := newClient(t)
	for _, id := range []string{"run-101", "run-102", "run-103", "run-other"} {
		run, err := c.GetPipelineRun(context.Background(), "", "", id)
		if err != nil {
			t.Fatalf("GetPipelineRun(%s): %v", id, err)
		}
		if run.URL == "" || run.PipelineID == "" {
			t.Fatalf("run %s missing fields: %+v", id, run)
		}
	}
}

func TestTriggerPipelinePending(t *testing.T) {
	c := newClient(t)
	run, err := c.TriggerPipeline(context.Background(), "", "", "release-gate", "main")
	if err != nil {
		t.Fatalf("TriggerPipeline: %v", err)
	}
	if run.Status != integrations.StatusPending {
		t.Fatalf("status=%q want pending", run.Status)
	}
}
