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

// guardResult represents the classification from the Claw guard endpoint.
type guardResult struct {
	Classification string   `json:"classification"`
	ViolationTypes []string `json:"violationTypes"`
}

var guardHTTP = &http.Client{Timeout: 2 * time.Second}

// guardInput checks input against the self-hosted Claw /v1/guard endpoint.
// Returns error if blocked, nil if passed or guard is unconfigured (fail-open).
func guardInput(ctx context.Context, input string) error {
	url := os.Getenv("CLAW_GATEWAY_URL")
	key := os.Getenv("CLAW_API_KEY")
	if url == "" || key == "" || input == "" {
		return nil
	}

	body, _ := json.Marshal(map[string]string{"input": input})
	req, err := http.NewRequestWithContext(ctx, "POST", url+"/v1/guard", bytes.NewReader(body))
	if err != nil {
		return nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	resp, err := guardHTTP.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	var result guardResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil
	}

	if result.Classification == "block" {
		return fmt.Errorf("guard blocked: %v", result.ViolationTypes)
	}
	return nil
}
