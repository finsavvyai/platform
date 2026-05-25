package aianalysis

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"context"

	"github.com/finsavvyai/pipewarden/internal/clawpipe"
	"github.com/finsavvyai/pipewarden/internal/metrics"
)

func (a *ClaudeAnalyzer) callClaude(ctx context.Context, prompt string) (*claudeResponse, error) {
	// Air-gap: refuse any outbound AI call (Anthropic or remote ClawPipe)
	// when PIPEWARDEN_OFFLINE_ONLY is set. The bundled llamafile path
	// served by clawpipe.OfflineProvider is the only sanctioned route in
	// this mode, and it is invoked separately by the heuristic pipeline.
	if clawpipe.IsOfflineOnly() {
		return nil, fmt.Errorf("claude analyzer: %w", clawpipe.ErrOfflineOnly)
	}

	// Route through ClawPipe if configured
	if a.ClawPipeClient != nil && a.ClawPipeClient.Enabled() {
		model := clawpipe.PickModel("", "full")
		resp, err := a.ClawPipeClient.Prompt(ctx, prompt, clawpipe.PromptOptions{
			Model:     model,
			MaxTokens: 4096,
		})
		if err != nil {
			return nil, fmt.Errorf("clawpipe request failed: %w", err)
		}
		metrics.RecordModelCall(model, resp.Meta.InputTokens, resp.Meta.OutputTokens)
		return &claudeResponse{
			Content: []claudeContent{{Type: "text", Text: resp.Text}},
			Usage: claudeUsage{
				InputTokens:  resp.Meta.InputTokens,
				OutputTokens: resp.Meta.OutputTokens,
			},
		}, nil
	}

	// Fall back to direct Anthropic API call
	reqBody := claudeRequest{
		Model:     a.config.Model,
		MaxTokens: 4096,
		Messages: []claudeMessage{
			{Role: "user", Content: prompt},
		},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.config.BaseURL+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", a.config.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claude API error (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var result claudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	metrics.RecordModelCall(claudeModelToShortName(a.config.Model), result.Usage.InputTokens, result.Usage.OutputTokens)
	return &result, nil
}

// claudeModelToShortName maps a full Anthropic model ID
// (e.g. "claude-sonnet-4-20250514") to the short name used in pricing
// tables ("claude-sonnet"). Falls back to "claude-sonnet" for unknown models.
func claudeModelToShortName(model string) string {
	switch {
	case strings.Contains(model, "opus"):
		return "claude-opus"
	case strings.Contains(model, "haiku"):
		return "claude-haiku"
	case strings.Contains(model, "sonnet"):
		return "claude-sonnet"
	default:
		return "claude-sonnet"
	}
}
