package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// TestScanDLP_Success verifies successful DLP scan.
func TestScanDLP_Success(t *testing.T) {
	h := newTestHandlers(t)

	payload := DLPScanRequest{
		Content:    "aws_key: AKIA1234567890ABCDEF",
		Source:     "config.yml",
		Connection: "test-conn",
		RunID:      "run-123",
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/api/v1/dlp/scan", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ScanDLP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	_ = json.NewDecoder(w.Body).Decode(&resp)

	if resp["source"] != "config.yml" {
		t.Errorf("expected source config.yml, got %v", resp["source"])
	}

	matches, ok := resp["matches"].([]interface{})
	if !ok {
		t.Error("expected matches array in response")
	}

	if len(matches) == 0 {
		t.Error("expected to find AWS key match")
	}
}

// TestScanDLP_EmptyContent rejects empty content.
func TestScanDLP_EmptyContent(t *testing.T) {
	h := newTestHandlers(t)

	payload := DLPScanRequest{
		Content: "",
		Source:  "empty.txt",
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/api/v1/dlp/scan", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ScanDLP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

// TestScanDLP_InvalidJSON rejects malformed JSON.
func TestScanDLP_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest("POST", "/api/v1/dlp/scan", bytes.NewReader([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ScanDLP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

// TestScanDLP_MethodNotAllowed rejects non-POST requests.
func TestScanDLP_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest("GET", "/api/v1/dlp/scan", nil)
	w := httptest.NewRecorder()

	h.ScanDLP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405, got %d", w.Code)
	}
}

// TestEvaluatePolicy_Success verifies policy evaluation.
func TestEvaluatePolicy_Success(t *testing.T) {
	h := newTestHandlers(t)

	payload := PolicyEvaluateRequest{
		ConnectionName: "test-conn",
		Owner:          "testorg",
		Repo:           "testrepo",
		RunID:          "run-123",
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/api/v1/policy/evaluate", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.EvaluatePolicy(w, req)

	// Connection won't exist; accept any of 404/502/200.
	if w.Code != http.StatusNotFound && w.Code != http.StatusBadGateway && w.Code != http.StatusOK {
		t.Errorf("unexpected status: %d", w.Code)
	}
}

// TestEvaluatePolicy_MissingFields rejects incomplete requests.
func TestEvaluatePolicy_MissingFields(t *testing.T) {
	h := newTestHandlers(t)

	tests := []struct {
		name    string
		payload PolicyEvaluateRequest
	}{
		{
			name: "missing connection_name",
			payload: PolicyEvaluateRequest{
				Owner: "testorg",
				Repo:  "testrepo",
				RunID: "run-123",
			},
		},
		{
			name: "missing owner",
			payload: PolicyEvaluateRequest{
				ConnectionName: "test-conn",
				Repo:           "testrepo",
				RunID:          "run-123",
			},
		},
		{
			name: "missing repo",
			payload: PolicyEvaluateRequest{
				ConnectionName: "test-conn",
				Owner:          "testorg",
				RunID:          "run-123",
			},
		},
		{
			name: "missing run_id",
			payload: PolicyEvaluateRequest{
				ConnectionName: "test-conn",
				Owner:          "testorg",
				Repo:           "testrepo",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.payload)
			req := httptest.NewRequest("POST", "/api/v1/policy/evaluate", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			h.EvaluatePolicy(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("expected status 400, got %d", w.Code)
			}
		})
	}
}

// TestEvaluatePolicy_InvalidJSON rejects malformed JSON.
func TestEvaluatePolicy_InvalidJSON(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest("POST", "/api/v1/policy/evaluate", bytes.NewReader([]byte("invalid")))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.EvaluatePolicy(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

// TestConfigureWebhook_Success verifies webhook configuration.
func TestConfigureWebhook_Success(t *testing.T) {
	h := newTestHandlers(t)

	config := WebhookConfig{
		URL:     "https://example.com/webhook",
		Secret:  "secret123",
		Events:  []string{"findings", "audit"},
		Enabled: true,
	}

	body, _ := json.Marshal(config)
	req := httptest.NewRequest("POST", "/api/v1/webhooks/configure", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ConfigureWebhook(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	_ = json.NewDecoder(w.Body).Decode(&resp)

	if resp["status"] != "configured" {
		t.Errorf("expected status 'configured', got %v", resp["status"])
	}
	if resp["url"] != "https://example.com/webhook" {
		t.Errorf("expected url in response, got %v", resp["url"])
	}
	if hasSecret, ok := resp["has_secret"].(bool); !ok || !hasSecret {
		t.Errorf("expected has_secret=true, got %v", resp["has_secret"])
	}

	getReq := httptest.NewRequest("GET", "/api/v1/webhooks/configure", nil)
	getW := httptest.NewRecorder()

	h.ConfigureWebhook(getW, getReq)

	if getW.Code != http.StatusOK {
		t.Fatalf("expected GET status 200, got %d", getW.Code)
	}

	var getResp map[string]interface{}
	if err := json.NewDecoder(getW.Body).Decode(&getResp); err != nil {
		t.Fatalf("failed to decode GET response: %v", err)
	}
	if configured, _ := getResp["configured"].(bool); !configured {
		t.Fatalf("expected persisted webhook config to report configured=true")
	}
	if hasSecret, _ := getResp["has_secret"].(bool); !hasSecret {
		t.Fatalf("expected persisted webhook config to preserve secret metadata")
	}
}

// TestConfigureWebhook_MissingURL rejects missing URL.
func TestConfigureWebhook_MissingURL(t *testing.T) {
	h := newTestHandlers(t)

	config := WebhookConfig{
		URL:     "",
		Secret:  "secret",
		Enabled: true,
	}

	body, _ := json.Marshal(config)
	req := httptest.NewRequest("POST", "/api/v1/webhooks/configure", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ConfigureWebhook(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

// TestConfigureWebhook_DefaultEvents assigns default events if none provided.
func TestConfigureWebhook_DefaultEvents(t *testing.T) {
	h := newTestHandlers(t)

	config := WebhookConfig{
		URL:     "https://example.com/webhook",
		Secret:  "secret",
		Events:  []string{},
		Enabled: true,
	}

	body, _ := json.Marshal(config)
	req := httptest.NewRequest("POST", "/api/v1/webhooks/configure", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ConfigureWebhook(w, req)

	var resp map[string]interface{}
	_ = json.NewDecoder(w.Body).Decode(&resp)

	events, ok := resp["events"].([]interface{})
	if !ok {
		t.Error("expected events array in response")
	}
	if len(events) == 0 {
		t.Error("expected default events to be set")
	}
}

// TestTestWebhook_Success verifies webhook delivery test.
func TestTestWebhook_Success(t *testing.T) {
	h := newTestHandlers(t)

	headers := make(http.Header)
	var body string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headers = r.Header.Clone()
		payload, _ := io.ReadAll(r.Body)
		body = string(payload)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}))
	defer server.Close()

	config := WebhookConfig{
		URL:     server.URL,
		Secret:  "secret",
		Enabled: true,
	}

	reqBody, _ := json.Marshal(config)
	req := httptest.NewRequest("POST", "/api/v1/webhooks/test", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.TestWebhook(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	_ = json.NewDecoder(w.Body).Decode(&resp)

	if success, ok := resp["success"].(bool); !ok || !success {
		t.Error("expected success=true in response")
	}
	if event, _ := resp["event"].(string); event != "webhook.test" {
		t.Fatalf("expected webhook.test event, got %q", event)
	}
	if signed, _ := resp["signed"].(bool); !signed {
		t.Fatalf("expected signed=true, got %v", resp["signed"])
	}
	if signature := headers.Get("X-PipeWarden-Signature"); signature == "" {
		t.Fatal("expected signed webhook request")
	}
	if event := headers.Get("X-PipeWarden-Event"); event != "webhook.test" {
		t.Fatalf("expected X-PipeWarden-Event=webhook.test, got %q", event)
	}
	if timestamp := headers.Get("X-PipeWarden-Timestamp"); timestamp == "" {
		t.Fatal("expected X-PipeWarden-Timestamp header")
	}
	if !strings.Contains(body, "\"event\":\"webhook.test\"") {
		t.Fatalf("expected webhook test payload, got %s", body)
	}
}

// TestTestWebhook_InvalidURL rejects invalid URLs.
func TestTestWebhook_InvalidURL(t *testing.T) {
	h := newTestHandlers(t)

	config := WebhookConfig{
		URL:     "not-a-valid-url",
		Secret:  "secret",
		Enabled: true,
	}

	body, _ := json.Marshal(config)
	req := httptest.NewRequest("POST", "/api/v1/webhooks/test", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.TestWebhook(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

// TestTestWebhook_ServerTimeout handles webhook timeout.
func TestTestWebhook_ServerTimeout(t *testing.T) {
	// This test would need a slow server, skipping for simplicity
	// In practice, we'd use a server that delays response
	t.Skip("timeout test requires slow server mock")
}

// TestTestWebhook_MissingURL rejects empty URL.
func TestTestWebhook_MissingURL(t *testing.T) {
	h := newTestHandlers(t)

	config := WebhookConfig{
		URL:     "",
		Secret:  "secret",
		Enabled: true,
	}

	body, _ := json.Marshal(config)
	req := httptest.NewRequest("POST", "/api/v1/webhooks/test", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.TestWebhook(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

// TestScanDLP_MultiplePatterns finds multiple secret patterns.
func TestScanDLP_MultiplePatterns(t *testing.T) {
	h := newTestHandlers(t)

	payload := DLPScanRequest{
		Content: `
		aws_key: AKIA1234567890ABCDEF
		github_token: ghp_1234567890123456789012345678901234567
		database: postgres://user:pass@host/db
		`,
		Source:     "config.yml",
		Connection: "test-conn",
		RunID:      "run-456",
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/api/v1/dlp/scan", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.ScanDLP(w, req)

	var resp map[string]interface{}
	_ = json.NewDecoder(w.Body).Decode(&resp)

	matches, _ := resp["matches"].([]interface{})
	if len(matches) < 2 {
		t.Errorf("expected at least 2 matches, got %d", len(matches))
	}
}

// TestContainsStep verifies step detection helper.
func TestContainsStep(t *testing.T) {
	tests := []struct {
		name     string
		steps    []integrations.PipelineStep
		search   string
		expected bool
	}{
		{
			name:     "found",
			steps:    []integrations.PipelineStep{{Name: "build"}, {Name: "test"}, {Name: "deploy"}},
			search:   "test",
			expected: true,
		},
		{
			name:     "not found",
			steps:    []integrations.PipelineStep{{Name: "build"}, {Name: "test"}, {Name: "deploy"}},
			search:   "lint",
			expected: false,
		},
		{
			name:     "empty steps",
			steps:    []integrations.PipelineStep{},
			search:   "test",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := containsStep(tt.steps, tt.search)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}
