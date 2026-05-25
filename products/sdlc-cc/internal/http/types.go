// Package http hosts the HTTP layer for the sdlc.cc gateway: the
// /v1/messages drop-in handler, the AI summarize endpoint, the
// transparent-proxy router, and the SSE streaming variant.
//
// Everything below the wire (DLP, providers, cache) lives in
// github.com/finsavvyai/sdlc-core. This package is purely the
// product-specific HTTP wrapper.
package http

// Message is one entry in the Anthropic Messages API request shape.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// MessagesRequest mirrors POST /v1/messages.
type MessagesRequest struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	Messages  []Message `json:"messages"`
	System    string    `json:"system,omitempty"`
	Stream    bool      `json:"stream,omitempty"`
}

// ContentBlock is one element of the response content array.
type ContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Usage is the token-count summary in the response.
type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// MessagesResponse is the Anthropic-compat response wire shape.
type MessagesResponse struct {
	ID         string         `json:"id"`
	Type       string         `json:"type"`
	Role       string         `json:"role"`
	Content    []ContentBlock `json:"content"`
	Model      string         `json:"model"`
	StopReason string         `json:"stop_reason"`
	Usage      Usage          `json:"usage"`
}
