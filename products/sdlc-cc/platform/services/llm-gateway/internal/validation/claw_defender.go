package validation

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/SDLC/llm-gateway/pkg/models"
)

// ClawPromptDefender adds self-hosted neural guard (Claw /v1/guard)
// on top of the existing regex-based DefaultPromptDefender.
// Two-layer defense: regex catches obvious patterns in <1ms,
// neural model catches subtle attacks in ~200ms.
type ClawPromptDefender struct {
	regex    *DefaultPromptDefender
	guardURL string
	guardKey string
	client   *http.Client
}

// NewClawPromptDefender creates a two-layer prompt defender.
// Falls back to regex-only if CLAW_GATEWAY_URL is not configured.
func NewClawPromptDefender() *ClawPromptDefender {
	return &ClawPromptDefender{
		regex:    NewDefaultPromptDefender(),
		guardURL: os.Getenv("CLAW_GATEWAY_URL"),
		guardKey: os.Getenv("CLAW_API_KEY"),
		client:   &http.Client{Timeout: 2 * time.Second},
	}
}

type guardResponse struct {
	Classification string   `json:"classification"`
	ViolationTypes []string `json:"violationTypes"`
}

// DetectPromptInjection runs both layers: regex first, then neural.
func (c *ClawPromptDefender) DetectPromptInjection(
	req *models.CompletionRequest,
) (bool, []string) {
	// Layer 1: fast regex patterns (<1ms)
	if detected, patterns := c.regex.DetectPromptInjection(req); detected {
		return true, patterns
	}

	// Layer 2: neural guard via self-hosted Claw (~200ms)
	if c.guardURL == "" || c.guardKey == "" {
		return false, nil
	}

	combined := extractMessages(req)
	if combined == "" {
		return false, nil
	}

	result, err := c.callGuard(combined)
	if err != nil {
		return false, nil // fail-open
	}

	if result.Classification == "block" {
		return true, result.ViolationTypes
	}
	return false, nil
}

// SanitizePrompt delegates to the regex defender.
func (c *ClawPromptDefender) SanitizePrompt(
	req *models.CompletionRequest,
) *models.CompletionRequest {
	return c.regex.SanitizePrompt(req)
}

func (c *ClawPromptDefender) callGuard(input string) (*guardResponse, error) {
	body, _ := json.Marshal(map[string]string{"input": input})
	req, err := http.NewRequest("POST", c.guardURL+"/v1/guard", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.guardKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("guard %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result guardResponse
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func extractMessages(req *models.CompletionRequest) string {
	var parts []string
	for _, msg := range req.Messages {
		if msg.Content != "" {
			parts = append(parts, msg.Content)
		}
	}
	return strings.Join(parts, "\n")
}
