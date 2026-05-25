package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSendCompletion_VerifiesRequest(t *testing.T) {
	var received CompletionRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&received)
		resp := CompletionResponse{ID: "c1", Model: "gpt-4"}
		json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	req := &CompletionRequest{
		Model: "gpt-4",
		Messages: []Message{
			{Role: "system", Content: "You are helpful"},
			{Role: "user", Content: "Hi"},
		},
	}
	_, err := c.SendCompletion(context.Background(), req)
	if err != nil {
		t.Fatalf("SendCompletion error: %v", err)
	}
	if len(received.Messages) != 2 {
		t.Errorf("len(Messages) = %d, want 2", len(received.Messages))
	}
	if received.Messages[0].Role != "system" {
		t.Errorf("Messages[0].Role = %q, want %q",
			received.Messages[0].Role, "system")
	}
}

func TestSendCompletion_FullResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := CompletionResponse{
			ID:     "cmpl-full",
			Object: "chat.completion",
			Model:  "gpt-4",
			Choices: []Choice{
				{Index: 0, Message: Message{Role: "assistant", Content: "Hi there"}, FinishReason: "stop"},
				{Index: 1, Message: Message{Role: "assistant", Content: "Hello"}, FinishReason: "stop"},
			},
			Usage: Usage{PromptTokens: 20, CompletionTokens: 10, TotalTokens: 30},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	c := &ClusterClient{baseURL: srv.URL, httpClient: srv.Client()}
	req := &CompletionRequest{Model: "gpt-4", Messages: []Message{{Role: "user", Content: "Hi"}}}
	got, err := c.SendCompletion(context.Background(), req)
	if err != nil {
		t.Fatalf("SendCompletion error: %v", err)
	}
	if got.Object != "chat.completion" {
		t.Errorf("Object = %q, want %q", got.Object, "chat.completion")
	}
	if len(got.Choices) != 2 {
		t.Fatalf("len(Choices) = %d, want 2", len(got.Choices))
	}
	if got.Choices[1].Message.Content != "Hello" {
		t.Errorf("Choices[1].Content = %q, want %q", got.Choices[1].Message.Content, "Hello")
	}
	if got.Usage.PromptTokens != 20 {
		t.Errorf("PromptTokens = %d, want 20", got.Usage.PromptTokens)
	}
}
