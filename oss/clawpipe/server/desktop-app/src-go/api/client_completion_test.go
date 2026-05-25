package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSendHeartbeat_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cluster/heartbeat" {
			t.Errorf("path = %q, want /cluster/heartbeat", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	hb := &Heartbeat{ID: "n1", Status: "online", Load: 50}
	err := c.SendHeartbeat(context.Background(), "n1", hb)
	if err != nil {
		t.Fatalf("SendHeartbeat error: %v", err)
	}
}

func TestSendCompletion_Success(t *testing.T) {
	resp := CompletionResponse{
		ID:    "cmpl-1",
		Model: "gpt-4",
		Choices: []Choice{
			{Index: 0, Message: Message{Role: "assistant", Content: "Hello"}, FinishReason: "stop"},
		},
		Usage: Usage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15},
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/cluster/completions" {
			t.Errorf("path = %q, want /cluster/completions", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	req := &CompletionRequest{
		Model:    "gpt-4",
		Messages: []Message{{Role: "user", Content: "Hi"}},
	}
	got, err := c.SendCompletion(context.Background(), req)
	if err != nil {
		t.Fatalf("SendCompletion error: %v", err)
	}
	if got.ID != "cmpl-1" {
		t.Errorf("ID = %q, want %q", got.ID, "cmpl-1")
	}
	if len(got.Choices) != 1 {
		t.Fatalf("len(Choices) = %d, want 1", len(got.Choices))
	}
	if got.Usage.TotalTokens != 15 {
		t.Errorf("TotalTokens = %d, want 15", got.Usage.TotalTokens)
	}
}

func TestSendCompletion_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	req := &CompletionRequest{Model: "gpt-4", Messages: []Message{{Role: "user", Content: "Hi"}}}
	_, err := c.SendCompletion(context.Background(), req)
	if err == nil {
		t.Fatal("SendCompletion expected error for 500, got nil")
	}
}

func TestSendHeartbeat_ConnectionError(t *testing.T) {
	c := &ClusterClient{
		baseURL:    "http://127.0.0.1:1",
		httpClient: &http.Client{},
	}
	hb := &Heartbeat{ID: "n1", Status: "online", Load: 0}
	err := c.SendHeartbeat(context.Background(), "n1", hb)
	if err == nil {
		t.Fatal("SendHeartbeat expected connection error, got nil")
	}
}
