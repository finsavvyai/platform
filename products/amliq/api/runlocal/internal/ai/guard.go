package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// GuardResult represents the classification from the Claw guard endpoint.
type GuardResult struct {
	Classification string   `json:"classification"`
	Reasoning      string   `json:"reasoning"`
	ViolationTypes []string `json:"violationTypes"`
	Blocked        bool     `json:"blocked"`
}

var guardClient = &http.Client{Timeout: 2 * time.Second}

// Guard checks input against the self-hosted Claw /v1/guard endpoint.
// Returns nil if guard is not configured or input passes.
// Returns error with violation details if input is blocked.
func Guard(ctx context.Context, input string) error {
	url := os.Getenv("CLAW_GATEWAY_URL")
	key := os.Getenv("CLAW_API_KEY")
	if url == "" || key == "" || input == "" {
		return nil // fail-open: no guard configured
	}

	body, _ := json.Marshal(map[string]string{"input": input})
	req, err := http.NewRequestWithContext(ctx, "POST", url+"/v1/guard", bytes.NewReader(body))
	if err != nil {
		return nil // fail-open
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	resp, err := guardClient.Do(req)
	if err != nil {
		return nil // fail-open: guard unreachable
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil // fail-open
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	var result GuardResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil
	}

	if result.Classification == "block" {
		return fmt.Errorf("guard blocked: %v", result.ViolationTypes)
	}
	return nil
}
