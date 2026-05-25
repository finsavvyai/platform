package api

// AnthropicMessage is one entry in the messages array.
// Content is string-only here; the full Anthropic API supports content
// blocks (images, tool_use, etc.) — those are explicitly out of scope
// for the AML drop-in MVP.
type AnthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// AnthropicMessagesRequest mirrors POST /v1/messages from Anthropic's
// public API. Only fields the AML drop-in honours are declared; extra
// fields decode-and-ignore so a Claude Code client setting tools or
// stop_sequences doesn't 400. Stream is honoured to the extent of
// returning a clear error rather than silently downgrading to
// non-streaming — see handler.
type AnthropicMessagesRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	Messages  []AnthropicMessage `json:"messages"`
	System    string             `json:"system,omitempty"`
	Stream    bool               `json:"stream,omitempty"`
}

// AnthropicContentBlock matches Anthropic's response content block.
type AnthropicContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// AnthropicUsage is the token counts Anthropic returns. We populate
// from a 4-chars-per-token estimator since aegis's Complete() interface
// doesn't surface real counts; honest fidelity beats fake precision.
type AnthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// AnthropicMessagesResponse is the shape clients (Claude Code, the
// official SDK, Cowork) parse. Drop-in compatibility = these field
// names and types must not drift.
type AnthropicMessagesResponse struct {
	ID         string                  `json:"id"`
	Type       string                  `json:"type"`
	Role       string                  `json:"role"`
	Content    []AnthropicContentBlock `json:"content"`
	Model      string                  `json:"model"`
	StopReason string                  `json:"stop_reason"`
	Usage      AnthropicUsage          `json:"usage"`
}
