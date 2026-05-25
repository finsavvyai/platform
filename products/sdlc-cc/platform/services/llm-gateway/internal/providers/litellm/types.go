package litellm

import "github.com/SDLC/llm-gateway/pkg/models"

// OpenAI-compatible wire types used to talk to the LiteLLM proxy. We keep
// our own definitions (rather than depend on go-openai) so we can
// freely pass through litellm-specific fields without forking a vendor
// struct, and so this package compiles without a provider SDK.

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Name    string `json:"name,omitempty"`
}

// chatRequest is the JSON body POSTed to /v1/chat/completions.
// We intentionally omit fields the Go gateway does not yet expose
// (tools, response_format, etc). `User` carries the tenant ID so
// LiteLLM can apply per-tenant rate limits.
type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	Temperature float64       `json:"temperature,omitempty"`
	TopP        float64       `json:"top_p,omitempty"`
	Stop        []string      `json:"stop,omitempty"`
	Stream      bool          `json:"stream,omitempty"`
	User        string        `json:"user,omitempty"`
}

type chatChoice struct {
	Index        int         `json:"index"`
	Message      chatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

type chatUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type chatResponse struct {
	ID      string       `json:"id"`
	Object  string       `json:"object"`
	Created int64        `json:"created"`
	Model   string       `json:"model"`
	Choices []chatChoice `json:"choices"`
	Usage   chatUsage    `json:"usage"`
}

// streamDelta mirrors the SSE delta shape returned by LiteLLM.
type streamDelta struct {
	Role    string `json:"role,omitempty"`
	Content string `json:"content,omitempty"`
}

type streamChoice struct {
	Index        int         `json:"index"`
	Delta        streamDelta `json:"delta"`
	FinishReason string      `json:"finish_reason,omitempty"`
}

type streamResponse struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	Created int64          `json:"created"`
	Model   string         `json:"model"`
	Choices []streamChoice `json:"choices"`
}

// buildRequest maps the gateway's internal CompletionRequest onto the
// OpenAI-compatible body expected by LiteLLM.
func buildRequest(req *models.CompletionRequest, stream bool) chatRequest {
	msgs := make([]chatMessage, len(req.Messages))
	for i, m := range req.Messages {
		msgs[i] = chatMessage{Role: m.Role, Content: m.Content, Name: m.Name}
	}
	user := req.TenantID
	if user == "" {
		user = req.UserID
	}
	return chatRequest{
		Model:       req.Model,
		Messages:    msgs,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		Stop:        req.Stop,
		Stream:      stream,
		User:        user,
	}
}
