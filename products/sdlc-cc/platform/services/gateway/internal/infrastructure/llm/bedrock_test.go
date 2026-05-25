package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestBedrock_Generate_RequestShape(t *testing.T) {
	var captured map[string]any
	var capturedAuth, capturedDate, capturedHost string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuth = r.Header.Get("Authorization")
		capturedDate = r.Header.Get("X-Amz-Date")
		capturedHost = r.Host
		if r.URL.Path != "/model/anthropic.claude-3-5-sonnet/invoke" {
			t.Errorf("path: %s", r.URL.Path)
		}
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &captured)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"content": [{"type":"text","text":"hi from claude"}],
			"model": "claude-3-5-sonnet",
			"stop_reason": "end_turn",
			"usage": {"input_tokens": 4, "output_tokens": 3}
		}`))
	}))
	defer srv.Close()

	b := NewBedrock("us-east-1", "AKID", "SECRET", "")
	b.SetBaseURL(srv.URL)
	b.SetClock(func() time.Time { return time.Unix(1700000000, 0) })

	resp, err := b.Generate(context.Background(), Request{
		Model:     "anthropic.claude-3-5-sonnet",
		MaxTokens: 64,
		Messages: []Message{
			{Role: "system", Content: "you are helpful"},
			{Role: "user", Content: "hi"},
		},
	})
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	if resp.Content != "hi from claude" {
		t.Fatalf("content: %q", resp.Content)
	}
	if resp.PromptTokens != 4 || resp.CompletionTokens != 3 {
		t.Fatalf("usage: %+v", resp)
	}
	if !strings.HasPrefix(capturedAuth, "AWS4-HMAC-SHA256 ") {
		t.Fatalf("auth header: %q", capturedAuth)
	}
	if !strings.Contains(capturedAuth, "Credential=AKID/") {
		t.Fatalf("missing credential scope: %q", capturedAuth)
	}
	if !strings.Contains(capturedAuth, "SignedHeaders=") {
		t.Fatalf("missing signed headers: %q", capturedAuth)
	}
	if !strings.Contains(capturedAuth, "Signature=") {
		t.Fatalf("missing signature: %q", capturedAuth)
	}
	if capturedDate == "" {
		t.Fatal("missing x-amz-date")
	}
	if capturedHost == "" {
		t.Fatal("missing host")
	}
	if captured["anthropic_version"] != "bedrock-2023-05-31" {
		t.Fatalf("body anthropic_version: %+v", captured)
	}
	if captured["system"] != "you are helpful" {
		t.Fatalf("system not extracted: %+v", captured)
	}
}

func TestBedrock_Generate_4xxPropagated(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"message":"AccessDenied"}`, http.StatusForbidden)
	}))
	defer srv.Close()
	b := NewBedrock("us-east-1", "AKID", "SECRET", "")
	b.SetBaseURL(srv.URL)
	_, err := b.Generate(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	if err == nil {
		t.Fatal("expected error")
	}
	if IsTransient(err) {
		t.Fatalf("4xx must NOT be transient")
	}
}

func TestBedrock_Generate_5xxIsTransient(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "server boom", http.StatusBadGateway)
	}))
	defer srv.Close()
	b := NewBedrock("us-east-1", "AKID", "SECRET", "")
	b.SetBaseURL(srv.URL)
	_, err := b.Generate(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	if err == nil || !IsTransient(err) {
		t.Fatalf("expected transient err; got %v", err)
	}
}

func TestBedrock_TitanEmbed_RoundTrip(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/model/amazon.titan-embed-text-v1/invoke" {
			t.Errorf("titan path: %s", r.URL.Path)
		}
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["inputText"] != "hello" {
			t.Errorf("inputText: %s", body["inputText"])
		}
		if !strings.HasPrefix(r.Header.Get("Authorization"), "AWS4-HMAC-SHA256 ") {
			t.Errorf("missing sigv4 auth")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"embedding":[0.1, 0.2, 0.3]}`))
	}))
	defer srv.Close()
	b := NewBedrock("us-east-1", "AKID", "SECRET", "")
	b.SetBaseURL(srv.URL)
	out, err := b.Embed(context.Background(), []string{"hello"})
	if err != nil {
		t.Fatalf("embed: %v", err)
	}
	if len(out) != 1 || len(out[0]) != 3 {
		t.Fatalf("embed shape: %+v", out)
	}
	if out[0][0] != 0.1 {
		t.Fatalf("embed[0]: %v", out[0])
	}
}

func TestBedrock_Stream_ParsesDelta(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/invoke-with-response-stream") {
			t.Errorf("stream path: %s", r.URL.Path)
		}
		// Bedrock event-stream frames typically wrap JSON; the parser
		// extracts balanced JSON objects from anywhere in the body.
		_, _ = io.WriteString(w, "\x00\x00\x00\x00")
		_, _ = io.WriteString(w, `{"type":"content_block_delta","delta":{"text":"He"}}`)
		_, _ = io.WriteString(w, "\x00\x01\x00")
		_, _ = io.WriteString(w, `{"type":"content_block_delta","delta":{"text":"llo"}}`)
		_, _ = io.WriteString(w, `{"type":"message_stop"}`)
	}))
	defer srv.Close()
	b := NewBedrock("us-east-1", "AKID", "SECRET", "")
	b.SetBaseURL(srv.URL)
	ch, err := b.Stream(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
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

