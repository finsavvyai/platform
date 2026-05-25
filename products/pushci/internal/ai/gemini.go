package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// Gemini uses Google's generateContent API, not the OpenAI chat-completions
// format. Auth: API key in ?key=<key> query param. Types in gemini_types.go.

const geminiBaseURL = "https://generativelanguage.googleapis.com/v1beta/models"

// DefaultGeminiModel is the pinned "latest flash" alias that Google
// maintains as the current stable Gemini flash model. Using the alias
// instead of an explicit version (gemini-2.5-flash, gemini-3-flash, etc.)
// means pushci users automatically track model upgrades without a code
// release. Override with PUSHCI_AI_MODEL if you need to pin a version.
//
// History: gemini-1.5-flash was deprecated and removed from v1beta in
// early 2026 — pinning to a specific version would have broken every
// install. The alias dodges that class of failure.
const DefaultGeminiModel = "gemini-flash-latest"

// gemini types (geminiPart, geminiContent, geminiRequest, geminiResponse) live in gemini_types.go.

func newGeminiClient() *Client {
	model := os.Getenv("PUSHCI_AI_MODEL")
	if model == "" {
		model = DefaultGeminiModel
	}
	return &Client{
		apiKey:   os.Getenv("GEMINI_API_KEY"),
		model:    model,
		endpoint: geminiBaseURL,
		provider: ProviderGemini,
	}
}

// askGemini calls Google's generateContent endpoint for the configured model.
// The model name goes in the URL path (unlike OpenAI-compat backends where
// it goes in the JSON body), so we build the URL per-request here.
func askGemini(ctx context.Context, c *Client, system, prompt string) (string, error) {
	url := fmt.Sprintf("%s/%s:generateContent?key=%s", c.endpoint, c.model, c.apiKey)

	req := geminiRequest{
		Contents: []geminiContent{
			{Role: "user", Parts: []geminiPart{{Text: prompt}}},
		},
	}
	if system != "" {
		req.SystemInstruction = &geminiContent{
			Parts: []geminiPart{{Text: system}},
		}
	}

	body, _ := json.Marshal(req)
	httpReq, _ := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("gemini api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini api %d: %s", resp.StatusCode, b)
	}

	var result geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("gemini decode: %w", err)
	}
	if result.Error != nil {
		return "", fmt.Errorf("gemini api error: %s", result.Error.Message)
	}
	if len(result.Candidates) == 0 {
		return "", fmt.Errorf("gemini empty response (no candidates)")
	}
	parts := result.Candidates[0].Content.Parts
	if len(parts) == 0 || parts[0].Text == "" {
		return "", fmt.Errorf("gemini empty response (no text parts)")
	}
	return parts[0].Text, nil
}
