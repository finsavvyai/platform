//go:build ignore

package llm

import (
	"fmt"
	"strings"
	"time"

	"github.com/SDLC/llm-gateway/internal/llm/providers"
)

// CompletionRequest represents a request to generate text completion
type CompletionRequest struct {
	TenantID    string                 `json:"tenant_id" binding:"required"`
	UserID      string                 `json:"user_id" binding:"required"`
	Provider    string                 `json:"provider,omitempty"`
	Model       string                 `json:"model" binding:"required"`
	Messages    []Message              `json:"messages" binding:"required"`
	MaxTokens   int                    `json:"max_tokens,omitempty"`
	Temperature float64                `json:"temperature,omitempty"`
	TopP        float64                `json:"top_p,omitempty"`
	Stream      bool                   `json:"stream,omitempty"`
	Stop        []string               `json:"stop,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// Message represents a message in the conversation
type Message struct {
	Role    string `json:"role" binding:"required,oneof=system user assistant tool"`
	Content string `json:"content" binding:"required"`
	Name    string `json:"name,omitempty"`
}

// CompletionResponse represents a response from the LLM
type CompletionResponse struct {
	ID       string    `json:"id"`
	Object   string    `json:"object"`
	Created  time.Time `json:"created"`
	Model    string    `json:"model"`
	Choices  []Choice  `json:"choices"`
	Usage    *Usage    `json:"usage"`
	Provider string    `json:"provider"`
}

// Choice represents a choice in the completion response
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message,omitempty"`
	Text         string  `json:"text,omitempty"`
	FinishReason string  `json:"finish_reason"`
	Delta        Message `json:"delta,omitempty"`
}

// Usage represents token usage information
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ModelInfo represents information about an available model
type ModelInfo struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	Provider    string             `json:"provider"`
	Created     time.Time          `json:"created"`
	OwnedBy     string             `json:"owned_by"`
	ContextSize int                `json:"context_size"`
	Pricing     *providers.Pricing `json:"pricing"`
}

// Validate validates the completion request
func (r *CompletionRequest) Validate() error {
	if r.Model == "" {
		return fmt.Errorf("model is required")
	}

	if len(r.Messages) == 0 {
		return fmt.Errorf("at least one message is required")
	}

	for _, msg := range r.Messages {
		if err := msg.Validate(); err != nil {
			return fmt.Errorf("invalid message: %w", err)
		}
	}

	if r.Temperature < 0 || r.Temperature > 2 {
		return fmt.Errorf("temperature must be between 0 and 2")
	}

	if r.TopP < 0 || r.TopP > 1 {
		return fmt.Errorf("top_p must be between 0 and 1")
	}

	if r.MaxTokens < 0 || r.MaxTokens > 32000 {
		return fmt.Errorf("max_tokens must be between 0 and 32000")
	}

	return nil
}

// Validate validates a message
func (m *Message) Validate() error {
	if m.Role == "" {
		return fmt.Errorf("role is required")
	}

	validRoles := []string{"system", "user", "assistant", "tool"}
	for _, role := range validRoles {
		if m.Role == role {
			return nil
		}
	}

	return fmt.Errorf("invalid role: %s", m.Role)
}

// Sanitize sanitizes the request content
func (r *CompletionRequest) Sanitize() {
	for i := range r.Messages {
		r.Messages[i].Content = strings.TrimSpace(r.Messages[i].Content)
		// Remove potential prompt injection patterns
		r.Messages[i].Content = removePromptInjectionPatterns(r.Messages[i].Content)
	}
}

// removePromptInjectionPatterns removes known prompt injection patterns
func removePromptInjectionPatterns(content string) string {
	patterns := []string{
		"ignore previous instructions",
		"disregard all previous",
		"forget everything",
		"new instruction:",
		"system override",
		"admin override",
	}

	lowerContent := strings.ToLower(content)
	for _, pattern := range patterns {
		if strings.Contains(lowerContent, pattern) {
			// Replace with safe placeholder
			content = "[FILTERED]"
			break
		}
	}

	return content
}
