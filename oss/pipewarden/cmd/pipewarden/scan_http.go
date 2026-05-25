package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// startScan POSTs to /api/v1/analysis/run and returns the run_id.
func startScan(ctx context.Context, baseURL, connection string) (string, error) {
	payload := map[string]string{
		"connection": connection,
		"type":       "heuristic",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	url := baseURL + "/api/v1/analysis/run"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("POST %s: %w", url, err)
	}
	defer func() { _ = resp.Body.Close() }()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	// Accept run_id at top level or nested under "data".
	if id, ok := result["run_id"].(string); ok && id != "" {
		return id, nil
	}
	if data, ok := result["data"].(map[string]interface{}); ok {
		if id, ok := data["run_id"].(string); ok && id != "" {
			return id, nil
		}
	}

	if resp.StatusCode >= 400 {
		msg, _ := result["error"].(string)
		return "", fmt.Errorf("server returned %d: %s", resp.StatusCode, msg)
	}

	return "", fmt.Errorf("response missing run_id field")
}

// fetchFindings retrieves findings from the API for the given connection/runID.
func fetchFindings(ctx context.Context, baseURL, connection, runID, format string) ([]interface{}, error) {
	if format == "sarif" {
		return nil, nil
	}

	url := fmt.Sprintf("%s/api/v1/analysis/findings?connection=%s&run_id=%s", baseURL, connection, runID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GET findings: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode findings response: %w", err)
	}

	rawFindings, ok := result["findings"]
	if !ok {
		return []interface{}{}, nil
	}

	findings, _ := rawFindings.([]interface{})
	return findings, nil
}

// printFindingsSARIF fetches and prints SARIF-format findings from the export endpoint.
func printFindingsSARIF(ctx context.Context, baseURL, connection string) error {
	url := fmt.Sprintf("%s/api/v1/analysis/findings/export?connection=%s&format=sarif",
		baseURL, connection)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	var buf bytes.Buffer
	if _, err = buf.ReadFrom(resp.Body); err != nil {
		return err
	}
	fmt.Println(buf.String())
	return nil
}
