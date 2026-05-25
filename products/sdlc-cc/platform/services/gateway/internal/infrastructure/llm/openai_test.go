package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAI_Generate_RequestShape(t *testing.T) {
	var captured map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer sk-test" {
			t.Errorf("auth header: %q", got)
		}
		if r.URL.Path != "/v1/chat/completions" {
			t.Errorf("path: %s", r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &captured)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"choices": [{"message": {"role": "assistant", "content": "yo"}, "finish_reason": "stop"}],
			"model": "gpt-4o-mini",
			"usage": {"prompt_tokens": 4, "completion_tokens": 1}
		}`))
	}))
	defer srv.Close()

	o := NewOpenAI("sk-test", srv.URL)
	resp, err := o.Generate(context.Background(), Request{
		Model:    "gpt-4o-mini",
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err != nil {
		t.Fatalf("unexpected: %v", err)
	}
	if resp.Content != "yo" {
		t.Fatalf("content: %q", resp.Content)
	}
	if captured["model"] != "gpt-4o-mini" {
		t.Fatalf("model: %v", captured["model"])
	}
}

func TestOpenAI_Embed(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/embeddings" {
			t.Errorf("path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": [
				{"index": 0, "embedding": [0.1, 0.2, 0.3]},
				{"index": 1, "embedding": [0.4, 0.5, 0.6]}
			]
		}`))
	}))
	defer srv.Close()

	o := NewOpenAI("k", srv.URL)
	got, err := o.Embed(context.Background(), []string{"a", "b"})
	if err != nil {
		t.Fatalf("embed err: %v", err)
	}
	if len(got) != 2 || len(got[0]) != 3 || got[1][2] != 0.6 {
		t.Fatalf("embeddings: %+v", got)
	}
}

func TestOpenAI_5xx_Transient(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "x", http.StatusInternalServerError)
	}))
	defer srv.Close()
	o := NewOpenAI("k", srv.URL)
	_, err := o.Generate(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	if err == nil || !IsTransient(err) {
		t.Fatalf("expected transient, got %v", err)
	}
}
