package handlers

import (
	"bufio"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSSEStreamProgress(t *testing.T) {
	h := &Handlers{
		ProgressRegistry: NewScanProgressRegistry(),
	}

	runID := "run-sse-001"
	ch := h.ProgressRegistry.Register(runID)
	_ = ch // handler uses lookup internally

	// Publish events in a goroutine so they are ready when handler reads
	go func() {
		time.Sleep(10 * time.Millisecond)
		h.ProgressRegistry.Publish(runID, ProgressEvent{Stage: "connecting", Percent: 10, Message: "connecting"})
		h.ProgressRegistry.Publish(runID, ProgressEvent{Stage: "scanning", Percent: 50, Message: "scanning"})
		h.ProgressRegistry.Publish(runID, ProgressEvent{Stage: "complete", Percent: 100, Message: "done"})
	}()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/scan/"+runID+"/progress", nil)
	rr := httptest.NewRecorder()

	// Run handler with a short deadline to avoid blocking
	done := make(chan struct{})
	go func() {
		h.StreamScanProgress(rr, req)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("handler did not return within timeout")
	}

	body := rr.Body.String()

	// Verify content-type header
	if ct := rr.Header().Get("Content-Type"); ct != "text/event-stream" {
		t.Errorf("expected text/event-stream, got %q", ct)
	}

	// Parse SSE lines and collect data payloads
	stages := collectSSEStages(t, body)

	if len(stages) != 3 {
		t.Errorf("expected 3 events, got %d\nbody:\n%s", len(stages), body)
	}

	expected := []string{"connecting", "scanning", "complete"}
	for i, want := range expected {
		if i >= len(stages) {
			break
		}
		if stages[i] != want {
			t.Errorf("event[%d]: expected stage %q, got %q", i, want, stages[i])
		}
	}
}

func TestSSERunNotFound(t *testing.T) {
	h := &Handlers{
		ProgressRegistry: NewScanProgressRegistry(),
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/scan/nonexistent-run/progress", nil)
	rr := httptest.NewRecorder()
	h.StreamScanProgress(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rr.Code)
	}
}

// collectSSEStages parses "data: {...}\n\n" lines and returns the stage field of each.
func collectSSEStages(t *testing.T, body string) []string {
	t.Helper()
	var stages []string
	scanner := bufio.NewScanner(strings.NewReader(body))
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		raw := strings.TrimPrefix(line, "data: ")
		var ev ProgressEvent
		if err := json.Unmarshal([]byte(raw), &ev); err != nil {
			t.Errorf("failed to unmarshal SSE data %q: %v", raw, err)
			continue
		}
		stages = append(stages, ev.Stage)
	}
	return stages
}
