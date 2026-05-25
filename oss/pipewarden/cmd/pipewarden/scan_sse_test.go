package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestStreamSSEParsing verifies that streamSSE correctly delivers 3 SSE events.
func TestStreamSSEParsing(t *testing.T) {
	events := []string{
		`data: {"stage":"connecting","percent":10,"message":"connecting"}`,
		`data: {"stage":"scanning","percent":50,"message":"scanning pipelines"}`,
		`data: {"stage":"complete","percent":100,"message":"done"}`,
	}
	sseBody := strings.Join(events, "\n\n") + "\n\n"

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, sseBody)
	}))
	defer srv.Close()

	received := make([]string, 0, 3)
	err := streamSSE(context.Background(), srv.URL, func(data string) {
		received = append(received, data)
	})
	if err != nil {
		t.Fatalf("streamSSE returned error: %v", err)
	}
	if len(received) != 3 {
		t.Fatalf("expected 3 events, got %d: %v", len(received), received)
	}

	stages := []string{"connecting", "scanning", "complete"}
	for i, raw := range received {
		var ev map[string]interface{}
		if err := json.Unmarshal([]byte(raw), &ev); err != nil {
			t.Errorf("event %d not valid JSON: %v", i, err)
			continue
		}
		got, _ := ev["stage"].(string)
		if got != stages[i] {
			t.Errorf("event %d: got stage %q, want %q", i, got, stages[i])
		}
	}
}

// TestStreamSSEKeepaliveSkipped verifies that SSE comment lines are ignored.
func TestStreamSSEKeepaliveSkipped(t *testing.T) {
	sseBody := fmt.Sprintf(
		": keepalive\n\ndata: %s\n\n: keepalive\n\n",
		`{"stage":"complete","percent":100,"message":"done"}`,
	)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, sseBody)
	}))
	defer srv.Close()

	received := 0
	err := streamSSE(context.Background(), srv.URL, func(data string) {
		received++
	})
	if err != nil {
		t.Fatalf("streamSSE error: %v", err)
	}
	if received != 1 {
		t.Errorf("expected 1 real event (keepalives skipped), got %d", received)
	}
}

// TestStreamSSEHTTPError verifies that a non-200 response returns an error.
func TestStreamSSEHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))
	defer srv.Close()

	err := streamSSE(context.Background(), srv.URL, func(data string) {})
	if err == nil {
		t.Fatal("expected error from 404 response, got nil")
	}
}
