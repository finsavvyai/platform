package nlp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/finsavvyai/pushci/internal/ai"
)

func executeClawAction(action *Action) (string, error) {
	endpoint := os.Getenv("CLAW_ENDPOINT")
	apiKey := os.Getenv("CLAW_API_KEY")
	projectID := os.Getenv("CLAW_PROJECT_ID")
	if endpoint == "" || apiKey == "" {
		return fmt.Sprintf("[claw] Would execute: %s (params: %v)",
			action.Type, action.Params), nil
	}

	prompt := fmt.Sprintf("Execute CI/CD action: %s with params: %v", action.Type, action.Params)
	payload, _ := json.Marshal(map[string]any{
		"messages":  []map[string]string{{"role": "user", "content": prompt}},
		"provider":  "anthropic",
		"model":     ai.DefaultAnthropicModel,
		"maxTokens": 1024,
	})

	req, err := http.NewRequest("POST", endpoint+"/v1/prompt", bytes.NewReader(payload)) // #nosec G704 -- endpoint is user-configured API URL
	if err != nil {
		return "", fmt.Errorf("claw request build failed: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("X-Project-Id", projectID)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req) // #nosec G704 -- endpoint is user-configured
	if err != nil {
		return "", fmt.Errorf("claw gateway unreachable: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("claw response parse failed: %w", err)
	}
	return result.Text, nil
}
