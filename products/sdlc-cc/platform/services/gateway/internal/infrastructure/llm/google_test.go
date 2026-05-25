package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestVertex_Generate_RequestShape(t *testing.T) {
	var captured map[string]any
	var auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		wantPath := "/v1/projects/proj/locations/us-central1/publishers/google/models/gemini-1.5-pro:generateContent"
		if r.URL.Path != wantPath {
			t.Errorf("path: %s", r.URL.Path)
		}
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &captured)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"candidates": [{
				"content": {"role":"model","parts":[{"text":"hi from gemini"}]},
				"finishReason": "STOP"
			}],
			"usageMetadata": {"promptTokenCount": 7, "candidatesTokenCount": 4},
			"modelVersion": "gemini-1.5-pro-001"
		}`))
	}))
	defer srv.Close()

	v := NewVertex("proj", "us-central1", StaticTokenSource("test-token"))
	v.SetBaseURL(srv.URL)
	resp, err := v.Generate(context.Background(), Request{
		Model:     "gemini-1.5-pro",
		MaxTokens: 64,
		Messages: []Message{
			{Role: "system", Content: "you are helpful"},
			{Role: "user", Content: "hi"},
		},
	})
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if resp.Content != "hi from gemini" {
		t.Fatalf("content: %q", resp.Content)
	}
	if resp.PromptTokens != 7 || resp.CompletionTokens != 4 {
		t.Fatalf("usage: %+v", resp)
	}
	if resp.Model != "gemini-1.5-pro-001" {
		t.Fatalf("model: %q", resp.Model)
	}
	if auth != "Bearer test-token" {
		t.Fatalf("auth: %q", auth)
	}
	si, _ := captured["systemInstruction"].(map[string]any)
	if si == nil {
		t.Fatalf("system not extracted: %+v", captured)
	}
	contents, _ := captured["contents"].([]any)
	if len(contents) != 1 {
		t.Fatalf("expected 1 user content; got %+v", contents)
	}
}

func TestVertex_Embed_RoundTrip(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		wantPath := "/v1/projects/proj/locations/us-central1/publishers/google/models/text-embedding-004:predict"
		if r.URL.Path != wantPath {
			t.Errorf("path: %s", r.URL.Path)
		}
		var got map[string]any
		_ = json.NewDecoder(r.Body).Decode(&got)
		ins, _ := got["instances"].([]any)
		if len(ins) != 2 {
			t.Errorf("instances: %+v", ins)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"predictions": [
				{"embeddings": {"values": [0.1, 0.2]}},
				{"embeddings": {"values": [0.3, 0.4]}}
			]
		}`))
	}))
	defer srv.Close()
	v := NewVertex("proj", "us-central1", StaticTokenSource("tok"))
	v.SetBaseURL(srv.URL)
	out, err := v.Embed(context.Background(), []string{"a", "b"})
	if err != nil {
		t.Fatalf("embed: %v", err)
	}
	if len(out) != 2 || out[0][0] != 0.1 || out[1][1] != 0.4 {
		t.Fatalf("embed shape: %+v", out)
	}
}

func TestVertex_5xx_IsTransient(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusBadGateway)
	}))
	defer srv.Close()
	v := NewVertex("p", "r", StaticTokenSource("t"))
	v.SetBaseURL(srv.URL)
	_, err := v.Generate(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	if err == nil || !IsTransient(err) {
		t.Fatalf("want transient; got %v", err)
	}
}

func TestVertex_4xx_NotTransient(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"error":"bad"}`, http.StatusBadRequest)
	}))
	defer srv.Close()
	v := NewVertex("p", "r", StaticTokenSource("t"))
	v.SetBaseURL(srv.URL)
	_, err := v.Generate(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	if err == nil {
		t.Fatal("expected err")
	}
	if IsTransient(err) {
		t.Fatalf("4xx must NOT be transient")
	}
}

func TestVertex_TokenSource_Error(t *testing.T) {
	v := NewVertex("p", "r", StaticTokenSource(""))
	_, err := v.Generate(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	if err == nil {
		t.Fatal("expected token error")
	}
	if !strings.Contains(err.Error(), "empty static token") {
		t.Fatalf("err: %v", err)
	}
}

func TestVertex_Stream_SSE(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, "data: {\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"He\"}]}}]}\n")
		_, _ = io.WriteString(w, "data: {\"candidates\":[{\"content\":{\"role\":\"model\",\"parts\":[{\"text\":\"llo\"}]},\"finishReason\":\"STOP\"}]}\n")
	}))
	defer srv.Close()
	v := NewVertex("p", "r", StaticTokenSource("tok"))
	v.SetBaseURL(srv.URL)
	ch, err := v.Stream(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	if err != nil {
		t.Fatalf("stream: %v", err)
	}
	var sb strings.Builder
	done := false
	for c := range ch {
		if c.Done {
			done = true
		}
		sb.WriteString(c.Delta)
	}
	if !done {
		t.Fatal("never saw Done")
	}
	if sb.String() != "Hello" {
		t.Fatalf("stream content: %q", sb.String())
	}
}
