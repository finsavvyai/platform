package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/finsavvyai/sdlc-core/dlp"
)

const (
	defaultModelTag = "claude-haiku-4-5"
	maxPromptChars  = 4000
)

// buildPrompt collapses the messages array into a single string the
// underlying Provider.Complete can consume. Each message is DLP-scrubbed
// before being included so PII never reaches the provider in any form.
// System prompt is prefixed if present.
func buildPrompt(req MessagesRequest) (string, error) {
	if len(req.Messages) == 0 {
		return "", fmt.Errorf("messages array empty")
	}
	var b strings.Builder
	if req.System != "" {
		b.WriteString("System: ")
		b.WriteString(dlp.MaskAML(req.System))
		b.WriteString("\n\n")
	}
	for _, m := range req.Messages {
		if m.Content == "" {
			continue
		}
		b.WriteString(strings.Title(m.Role))
		b.WriteString(": ")
		b.WriteString(dlp.MaskAML(m.Content))
		b.WriteString("\n\n")
	}
	out := strings.TrimSpace(b.String())
	if out == "" {
		return "", fmt.Errorf("prompt empty after scrub")
	}
	if len(out) > maxPromptChars {
		out = out[:maxPromptChars]
	}
	return out, nil
}

func defaultModel(m string) string {
	if m == "" {
		return defaultModelTag
	}
	return m
}

// estTokens uses the canonical 4-chars-per-token approximation.
// Off by 5-15%; honest fidelity beats fake precision.
func estTokens(s string) int { return (len(s) + 3) / 4 }

func writeErr(w http.ResponseWriter, code, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": msg, "code": code,
	})
}
