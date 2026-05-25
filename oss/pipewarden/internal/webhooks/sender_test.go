package webhooks

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/logging"
)

// TestNewWebhookSender verifies WebhookSender creation.
func TestNewWebhookSender(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "info", JSON: true})
	sender := NewWebhookSender("http://example.com/webhook", "secret-key", logger)

	if sender == nil {
		t.Fatal("expected non-nil sender")
	}
	if sender.endpoint != "http://example.com/webhook" {
		t.Errorf("unexpected endpoint: %s", sender.endpoint)
	}
	if sender.secret != "secret-key" {
		t.Errorf("unexpected secret")
	}
}

// TestSendFinding_Success verifies successful finding delivery with HMAC signature.
func TestSendFinding_Success(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "info", JSON: true})

	var receivedPayload []byte
	var receivedSignature string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedSignature = r.Header.Get("X-PipeWarden-Signature")
		payload, _ := io.ReadAll(r.Body)
		receivedPayload = payload

		if r.Header.Get("Content-Type") != "application/json" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		if receivedSignature == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprintf(w, `{"status":"ok"}`)
	}))
	defer server.Close()

	sender := NewWebhookSender(server.URL, "test-secret", logger)

	finding := FindingEvent{
		ID:             123,
		ConnectionName: "test-conn",
		RunID:          "run-456",
		Severity:       "high",
		Title:          "SQL Injection Found",
		Description:    "Potential SQL injection in user input",
		Timestamp:      time.Now(),
	}

	err := sender.SendFinding(context.Background(), finding)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(receivedPayload) == 0 {
		t.Fatal("expected payload to be delivered")
	}

	// Verify signature is HMAC-SHA256
	if receivedSignature == "" {
		t.Fatal("expected signature in header")
	}

	// Verify signature format (should be hex-encoded)
	if len(receivedSignature) != 64 {
		t.Errorf("unexpected signature length: %d (expected 64)", len(receivedSignature))
	}
}

// TestSendFinding_ServerError handles server errors gracefully.
func TestSendFinding_ServerError(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "info", JSON: true})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = fmt.Fprintf(w, `{"error":"server error"}`)
	}))
	defer server.Close()

	sender := NewWebhookSender(server.URL, "secret", logger)

	finding := FindingEvent{
		ID:        1,
		Title:     "Test Finding",
		Timestamp: time.Now(),
	}

	err := sender.SendFinding(context.Background(), finding)
	if err == nil {
		t.Error("expected error for 500 status")
	}
}

// TestSendFinding_Timeout handles context timeout.
func TestSendFinding_Timeout(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "info", JSON: true})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second) // Sleep longer than timeout
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	sender := NewWebhookSender(server.URL, "secret", logger)

	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	finding := FindingEvent{
		ID:        1,
		Title:     "Test Finding",
		Timestamp: time.Now(),
	}

	err := sender.SendFinding(ctx, finding)
	if err == nil {
		t.Error("expected timeout error")
	}
}

// TestSendFinding_InvalidURL handles invalid webhook URL.
func TestSendFinding_InvalidURL(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "info", JSON: true})
	sender := NewWebhookSender("not-a-valid-url://invalid", "secret", logger)

	finding := FindingEvent{
		ID:        1,
		Title:     "Test Finding",
		Timestamp: time.Now(),
	}

	err := sender.SendFinding(context.Background(), finding)
	if err == nil {
		t.Error("expected error for invalid URL")
	}
}

// TestGenerateSignature verifies HMAC-SHA256 signature generation.
func TestGenerateSignature(t *testing.T) {
	secret := "my-secret"

	// Call internal function (if exposed) or verify through sender
	logger, _ := logging.New(&logging.Config{Level: "info", JSON: true})
	sender := NewWebhookSender("http://example.com", secret, logger)

	// We'll verify signature generation indirectly through a test server
	var actualSignature string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		actualSignature = r.Header.Get("X-PipeWarden-Signature")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	sender.endpoint = server.URL

	finding := FindingEvent{
		ID:        1,
		Title:     "Test",
		Timestamp: time.Unix(1704067200, 0).UTC(),
	}

	payload, _ := json.Marshal(finding)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(payload)
	expected := hex.EncodeToString(h.Sum(nil))

	_ = sender.SendFinding(context.Background(), finding)

	if actualSignature != expected {
		t.Errorf("signature mismatch: got %s, expected %s", actualSignature, expected)
	}
}

// TestSendBatchFindings verifies sending multiple findings.
func TestSendBatchFindings(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "info", JSON: true})

	var receivedCount int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedCount++
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	sender := NewWebhookSender(server.URL, "secret", logger)

	findings := []FindingEvent{
		{ID: 1, Title: "Finding 1", Timestamp: time.Now()},
		{ID: 2, Title: "Finding 2", Timestamp: time.Now()},
		{ID: 3, Title: "Finding 3", Timestamp: time.Now()},
	}

	for _, finding := range findings {
		err := sender.SendFinding(context.Background(), finding)
		if err != nil {
			t.Fatalf("unexpected error sending finding %d: %v", finding.ID, err)
		}
	}

	if receivedCount != 3 {
		t.Errorf("expected 3 requests, got %d", receivedCount)
	}
}

// TestSendFinding_NoEndpoint verifies disabled webhook handling.
func TestSendFinding_NoEndpoint(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "info", JSON: true})
	sender := NewWebhookSender("", "", logger)

	finding := FindingEvent{
		ID:        1,
		Title:     "Test",
		Timestamp: time.Now(),
	}

	err := sender.SendFinding(context.Background(), finding)
	if err != nil {
		t.Fatalf("unexpected error for disabled webhook: %v", err)
	}
}

// TestSendFinding_PayloadStructure verifies correct JSON payload.
func TestSendFinding_PayloadStructure(t *testing.T) {
	logger, _ := logging.New(&logging.Config{Level: "info", JSON: true})

	var receivedPayload FindingEvent
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &receivedPayload)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	sender := NewWebhookSender(server.URL, "secret", logger)

	finding := FindingEvent{
		ID:             123,
		ConnectionName: "prod-conn",
		RunID:          "run-xyz",
		Severity:       "critical",
		Title:          "RCE Vulnerability",
		Description:    "Potential RCE in endpoint",
		Status:         "open",
	}

	_ = sender.SendFinding(context.Background(), finding)

	if receivedPayload.ID != 123 {
		t.Errorf("expected ID 123, got %d", receivedPayload.ID)
	}
	if receivedPayload.Title != "RCE Vulnerability" {
		t.Errorf("expected title 'RCE Vulnerability', got %s", receivedPayload.Title)
	}
	if receivedPayload.Severity != "critical" {
		t.Errorf("expected severity 'critical', got %s", receivedPayload.Severity)
	}
}
