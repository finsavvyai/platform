package clawpipe

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// mockGateway returns a test server that echoes a fixed response.
func mockGateway() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		resp := GatewayResponse{Text: "mock answer", TokensIn: 10, TokensOut: 5, LatencyMs: 50}
		json.NewEncoder(w).Encode(resp)
	}))
}

func newTestPipe(url string) *ClawPipe {
	return New(Config{
		APIKey:     "test-key",
		ProjectID:  "test-proj",
		GatewayURL: url,
	})
}

func TestPipelineBoosted(t *testing.T) {
	ts := mockGateway()
	defer ts.Close()
	pipe := newTestPipe(ts.URL)

	res, err := pipe.Prompt(context.Background(), "Calculate 42 * 2", nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.Text != "84" {
		t.Fatalf("expected 84, got %q", res.Text)
	}
	if !res.Meta.Boosted {
		t.Fatal("expected boosted=true")
	}
	if res.Meta.EstimatedCostUsd != 0 {
		t.Fatal("boosted should be free")
	}
}

func TestPipelineGateway(t *testing.T) {
	ts := mockGateway()
	defer ts.Close()
	pipe := newTestPipe(ts.URL)

	res, err := pipe.Prompt(context.Background(), "Tell me a story", nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.Text != "mock answer" {
		t.Fatalf("expected mock answer, got %q", res.Text)
	}
	if res.Meta.Boosted {
		t.Fatal("should not be boosted")
	}
	if res.Meta.Route == "" {
		t.Fatal("expected a route")
	}
}

func TestPipelineCacheHit(t *testing.T) {
	ts := mockGateway()
	defer ts.Close()
	pipe := newTestPipe(ts.URL)

	// First call goes to gateway
	_, err := pipe.Prompt(context.Background(), "cached prompt", nil)
	if err != nil {
		t.Fatal(err)
	}
	// Second call should hit cache
	res, err := pipe.Prompt(context.Background(), "cached prompt", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Meta.Cached {
		t.Fatal("expected cached=true on second call")
	}
	if res.Meta.EstimatedCostUsd != 0 {
		t.Fatal("cached should be free")
	}
}

func TestPipelineStats(t *testing.T) {
	ts := mockGateway()
	defer ts.Close()
	pipe := newTestPipe(ts.URL)

	pipe.Prompt(context.Background(), "Calculate 1 + 1", nil)
	s := pipe.Stats()
	if s.TotalRequests != 1 {
		t.Fatalf("expected 1 request, got %d", s.TotalRequests)
	}
}

func TestPipelineGatewayError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal error", 500)
	}))
	defer srv.Close()
	pipe := newTestPipe(srv.URL)

	_, err := pipe.Prompt(context.Background(), "fail please", nil)
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Fatalf("expected 500 in error, got %q", err.Error())
	}
}

func TestPipelineContextCancel(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer srv.Close()
	pipe := newTestPipe(srv.URL)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := pipe.Prompt(ctx, "should cancel", nil)
	if err == nil {
		t.Fatal("expected error from cancelled context")
	}
}

func TestPipelineWithOptions(t *testing.T) {
	ts := mockGateway()
	defer ts.Close()
	pipe := newTestPipe(ts.URL)

	opts := &PromptOptions{System: "You are helpful", MaxTokens: 100}
	res, err := pipe.Prompt(context.Background(), "hello", opts)
	if err != nil {
		t.Fatal(err)
	}
	if res.Meta.Packed != true {
		t.Fatal("expected packed=true with system message")
	}
}

func TestPipelineMultipleRequests(t *testing.T) {
	ts := mockGateway()
	defer ts.Close()
	pipe := newTestPipe(ts.URL)

	for i := 0; i < 5; i++ {
		_, err := pipe.Prompt(context.Background(), "Calculate 1 + 1", nil)
		if err != nil {
			t.Fatal(err)
		}
	}
	s := pipe.Stats()
	if s.TotalRequests != 5 {
		t.Fatalf("expected 5 requests, got %d", s.TotalRequests)
	}
}
