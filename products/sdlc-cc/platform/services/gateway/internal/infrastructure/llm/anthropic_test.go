package llm

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAnthropic_Generate_RequestShape(t *testing.T) {
	var captured map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("x-api-key"); got != "secret" {
			t.Errorf("missing api-key, got %q", got)
		}
		if r.Header.Get("anthropic-version") == "" {
			t.Error("missing anthropic-version header")
		}
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &captured)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"content": [{"type": "text", "text": "hello world"}],
			"model": "claude-3-5-sonnet",
			"stop_reason": "end_turn",
			"usage": {"input_tokens": 5, "output_tokens": 2}
		}`))
	}))
	defer srv.Close()

	a := NewAnthropic("secret", srv.URL)
	resp, err := a.Generate(context.Background(), Request{
		Model:     "claude-3-5-sonnet",
		MaxTokens: 100,
		Messages: []Message{
			{Role: "system", Content: "you are helpful"},
			{Role: "user", Content: "hi"},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Content != "hello world" {
		t.Fatalf("content: %q", resp.Content)
	}
	if resp.PromptTokens != 5 || resp.CompletionTokens != 2 {
		t.Fatalf("usage: %+v", resp)
	}
	if captured["system"] != "you are helpful" {
		t.Fatalf("system not extracted: %+v", captured)
	}
	msgs, _ := captured["messages"].([]any)
	if len(msgs) != 1 {
		t.Fatalf("system should be stripped from messages: %+v", msgs)
	}
}

func TestAnthropic_5xx_IsTransient(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusBadGateway)
	}))
	defer srv.Close()
	a := NewAnthropic("k", srv.URL)
	_, err := a.Generate(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	if err == nil {
		t.Fatal("expected error")
	}
	if !IsTransient(err) {
		t.Fatalf("5xx must be transient, got %v", err)
	}
}

func TestAnthropic_4xx_NotTransient(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "bad request", http.StatusBadRequest)
	}))
	defer srv.Close()
	a := NewAnthropic("k", srv.URL)
	_, err := a.Generate(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	if err == nil {
		t.Fatal("expected error")
	}
	if IsTransient(err) {
		t.Fatalf("4xx must NOT be transient, got %v", err)
	}
}

func TestAnthropic_Embed_Unsupported(t *testing.T) {
	a := NewAnthropic("k", "http://unused")
	_, err := a.Embed(context.Background(), []string{"x"})
	if !errors.Is(err, ErrEmbedUnsupported) {
		t.Fatalf("want ErrEmbedUnsupported, got %v", err)
	}
}

func TestAnthropic_Stream_SSE(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, "data: {\"type\":\"content_block_delta\",\"delta\":{\"text\":\"Hel\"}}\n")
		_, _ = io.WriteString(w, "data: {\"type\":\"content_block_delta\",\"delta\":{\"text\":\"lo\"}}\n")
		_, _ = io.WriteString(w, "data: [DONE]\n")
	}))
	defer srv.Close()
	a := NewAnthropic("k", srv.URL)
	ch, err := a.Stream(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	if err != nil {
		t.Fatalf("stream err: %v", err)
	}
	var sb strings.Builder
	done := false
	for chunk := range ch {
		if chunk.Done {
			done = true
		}
		sb.WriteString(chunk.Delta)
	}
	if !done {
		t.Fatal("never saw Done")
	}
	if sb.String() != "Hello" {
		t.Fatalf("stream content: %q", sb.String())
	}
}
