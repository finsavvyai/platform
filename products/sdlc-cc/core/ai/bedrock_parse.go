package ai

import (
	"encoding/json"
	"fmt"
	"strings"
)

// bedrockClaudeResp mirrors the shape Anthropic-on-Bedrock returns.
// Only the fields we actually use are declared; the rest is ignored
// so an Anthropic schema bump doesn't break the unmarshal.
type bedrockClaudeResp struct {
	Content []struct {
		Text string `json:"text"`
		Type string `json:"type"`
	} `json:"content"`
}

// parseBedrockResponse extracts the concatenated text blocks from the
// /model/{model}/invoke JSON response. Empty content arrays return
// an explicit error rather than empty string so callers don't audit
// a successful AI call that produced nothing.
func parseBedrockResponse(raw []byte) (string, error) {
	var br bedrockClaudeResp
	if err := json.Unmarshal(raw, &br); err != nil {
		return "", fmt.Errorf("bedrock decode: %w", err)
	}
	if len(br.Content) == 0 {
		return "", fmt.Errorf("bedrock: empty response")
	}
	var sb strings.Builder
	for _, c := range br.Content {
		if c.Type == "text" {
			sb.WriteString(c.Text)
		}
	}
	if sb.Len() == 0 {
		return "", fmt.Errorf("bedrock: no text content")
	}
	return sb.String(), nil
}
