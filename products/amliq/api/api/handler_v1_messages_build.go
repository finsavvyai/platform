package api

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/security"
)

// buildV1MessagesPrompt scrubs every user/assistant message and the
// system prompt with MaskAML, then concatenates them in role-prefixed
// form. aegis's Complete() takes a single string; FI prompts are short
// enough that the array→string round-trip is acceptable.
func buildV1MessagesPrompt(req AnthropicMessagesRequest) (string, error) {
	if len(req.Messages) == 0 {
		return "", fmt.Errorf("messages array empty")
	}
	var b strings.Builder
	if req.System != "" {
		b.WriteString("System: ")
		b.WriteString(security.MaskAML(security.SanitizeName(req.System)))
		b.WriteString("\n\n")
	}
	for _, m := range req.Messages {
		if m.Content == "" {
			continue
		}
		b.WriteString(strings.Title(m.Role))
		b.WriteString(": ")
		b.WriteString(security.MaskAML(security.SanitizeName(m.Content)))
		b.WriteString("\n\n")
	}
	out := strings.TrimSpace(b.String())
	if out == "" {
		return "", fmt.Errorf("prompt empty after sanitization")
	}
	return security.MaxLength(out, maxAITextChars), nil
}

// writeAnthropicResponse builds the wire-shape Claude Code / official
// SDK / Cowork parse. ID is "msg_aegis_" + nano-ts; not a real
// Anthropic ID (callers shouldn't reuse it for tools API).
func writeAnthropicResponse(w http.ResponseWriter, prompt, text, model string) {
	resp := AnthropicMessagesResponse{
		ID:    fmt.Sprintf("msg_aegis_%d", time.Now().UnixNano()),
		Type:  "message",
		Role:  "assistant",
		Model: defaultModel(model),
		Content: []AnthropicContentBlock{
			{Type: "text", Text: text},
		},
		StopReason: "end_turn",
		Usage: AnthropicUsage{
			InputTokens:  estimateTokens(prompt),
			OutputTokens: estimateTokens(text),
		},
	}
	Success(w, resp, http.StatusOK)
}

func defaultModel(m string) string {
	if m == "" {
		return aiModelTag
	}
	return m
}

// estimateTokens uses the canonical 4-chars-per-token approximation
// the OpenAI cookbook publishes. Off by 5-15%; honest fidelity beats
// fake precision for the billing UX. Hard caps still come from spend
// tracker which uses real upstream usage when available.
func estimateTokens(s string) int { return (len(s) + 3) / 4 }
