package billing

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// errReader is an io.Reader that always returns an error, used to simulate
// a body read failure inside WebhookHandler.
type errReader struct{ msg string }

func (e *errReader) Read(_ []byte) (int, error) {
	return 0, errors.New(e.msg)
}

// ---------------------------------------------------------------------------
// VerifyWebhookSignature — missing branches
// ---------------------------------------------------------------------------

// TestVerifyWebhookSignature_EmptyKey verifies that an unconfigured client
// always rejects any signature (the first guard in VerifyWebhookSignature).
func TestVerifyWebhookSignature_EmptyKey(t *testing.T) {
	client := New(LemonSqueezyConfig{}) // WebhookKey intentionally blank
	body := []byte(`{"meta":{"event_name":"subscription_created"}}`)
	// Even a correctly-formed signature must be rejected when the key is empty.
	valid := client.VerifyWebhookSignature(body, "sha256=abc123")
	if valid {
		t.Error("expected VerifyWebhookSignature to return false when WebhookKey is empty")
	}
}

// TestVerifyWebhookSignature_EmptySignatureHeader verifies rejection when the
// caller sends no X-Signature header at all (empty string).
func TestVerifyWebhookSignature_EmptySignatureHeader(t *testing.T) {
	client := New(LemonSqueezyConfig{WebhookKey: "secret"})
	body := []byte(`{"meta":{"event_name":"subscription_created"}}`)
	valid := client.VerifyWebhookSignature(body, "")
	if valid {
		t.Error("expected VerifyWebhookSignature to return false for empty signature")
	}
}

// TestVerifyWebhookSignature_WrongSecret verifies that a signature produced
// with a different key is correctly rejected.
func TestVerifyWebhookSignature_WrongSecret(t *testing.T) {
	client := New(LemonSqueezyConfig{WebhookKey: "correct-secret"})
	body := []byte(`{"meta":{"event_name":"subscription_created"}}`)
	// Produce signature with the wrong key.
	h := hmac.New(sha256.New, []byte("wrong-secret"))
	h.Write(body)
	sig := "sha256=" + hex.EncodeToString(h.Sum(nil))

	valid := client.VerifyWebhookSignature(body, sig)
	if valid {
		t.Error("expected VerifyWebhookSignature to return false for wrong secret")
	}
}

// TestVerifyWebhookSignature_MissingPrefix verifies that a raw hex digest
// (without the "sha256=" prefix) is rejected.
func TestVerifyWebhookSignature_MissingPrefix(t *testing.T) {
	secret := "test-secret"
	client := New(LemonSqueezyConfig{WebhookKey: secret})
	body := []byte(`{"meta":{"event_name":"subscription_created"}}`)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(body)
	rawHex := hex.EncodeToString(h.Sum(nil)) // no "sha256=" prefix

	valid := client.VerifyWebhookSignature(body, rawHex)
	if valid {
		t.Error("expected VerifyWebhookSignature to reject signature without sha256= prefix")
	}
}

// ---------------------------------------------------------------------------
// ParseWebhookEvent
// ---------------------------------------------------------------------------

// TestParseWebhookEvent_ValidPayload verifies successful decode of a
// well-formed subscription_created webhook body.
func TestParseWebhookEvent_ValidPayload(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	body := []byte(`{
		"meta": {"event_name": "subscription_created", "custom_data": null},
		"data": {"attributes": {"status": "active"}}
	}`)

	event, err := client.ParseWebhookEvent(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event == nil {
		t.Fatal("expected non-nil event")
	}
	if event.Meta.EventName != "subscription_created" {
		t.Errorf("expected event_name='subscription_created', got %q", event.Meta.EventName)
	}
	if event.Data.Attributes.Status != "active" {
		t.Errorf("expected status='active', got %q", event.Data.Attributes.Status)
	}
}

// TestParseWebhookEvent_InvalidJSON verifies that malformed JSON returns an
// error and a nil event pointer.
func TestParseWebhookEvent_InvalidJSON(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	body := []byte(`{invalid json`)

	event, err := client.ParseWebhookEvent(body)
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
	if event != nil {
		t.Error("expected nil event for invalid JSON")
	}
}

// TestParseWebhookEvent_EmptyBody verifies that an empty body returns an error.
func TestParseWebhookEvent_EmptyBody(t *testing.T) {
	client := New(LemonSqueezyConfig{})
	event, err := client.ParseWebhookEvent([]byte{})
	if err == nil {
		t.Error("expected error for empty body")
	}
	if event != nil {
		t.Error("expected nil event for empty body")
	}
}

// ---------------------------------------------------------------------------
// WebhookHandler — full dispatch coverage
// ---------------------------------------------------------------------------

// signBody produces the X-Signature header value for a given body and key.
func signBody(t *testing.T, key string, body []byte) string {
	t.Helper()
	h := hmac.New(sha256.New, []byte(key))
	h.Write(body)
	return "sha256=" + hex.EncodeToString(h.Sum(nil))
}

func webhookRequest(t *testing.T, key string, payload []byte) (*httptest.ResponseRecorder, *http.Request) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Signature", signBody(t, key, payload))
	return httptest.NewRecorder(), req
}

// TestWebhookHandler_SubscriptionCreated exercises the subscription_created branch.
func TestWebhookHandler_SubscriptionCreated(t *testing.T) {
	key := "test-key"
	client := New(LemonSqueezyConfig{WebhookKey: key})
	payload := []byte(`{"meta":{"event_name":"subscription_created"},"data":{"attributes":{"status":"active"}}}`)
	w, req := webhookRequest(t, key, payload)

	err := client.WebhookHandler(w, req)
	if err != nil {
		t.Errorf("unexpected error for subscription_created: %v", err)
	}
}

// TestWebhookHandler_SubscriptionUpdated exercises the subscription_updated branch.
func TestWebhookHandler_SubscriptionUpdated(t *testing.T) {
	key := "test-key"
	client := New(LemonSqueezyConfig{WebhookKey: key})
	payload := []byte(`{"meta":{"event_name":"subscription_updated"},"data":{"attributes":{"status":"active"}}}`)
	w, req := webhookRequest(t, key, payload)

	err := client.WebhookHandler(w, req)
	if err != nil {
		t.Errorf("unexpected error for subscription_updated: %v", err)
	}
}

// TestWebhookHandler_SubscriptionCancelled exercises the subscription_cancelled branch.
func TestWebhookHandler_SubscriptionCancelled(t *testing.T) {
	key := "test-key"
	client := New(LemonSqueezyConfig{WebhookKey: key})
	payload := []byte(`{"meta":{"event_name":"subscription_cancelled"},"data":{"attributes":{"status":"cancelled"}}}`)
	w, req := webhookRequest(t, key, payload)

	err := client.WebhookHandler(w, req)
	if err != nil {
		t.Errorf("unexpected error for subscription_cancelled: %v", err)
	}
}

// TestWebhookHandler_UnknownEvent verifies that an unrecognised event name
// returns an error from the default switch branch.
func TestWebhookHandler_UnknownEvent(t *testing.T) {
	key := "test-key"
	client := New(LemonSqueezyConfig{WebhookKey: key})
	payload := []byte(`{"meta":{"event_name":"order_created"},"data":{"attributes":{}}}`)
	w, req := webhookRequest(t, key, payload)

	err := client.WebhookHandler(w, req)
	if err == nil {
		t.Error("expected error for unknown event type")
	}
	if !strings.Contains(err.Error(), "unknown event type") {
		t.Errorf("expected 'unknown event type' in error, got: %v", err)
	}
}

// TestWebhookHandler_InvalidSignature verifies rejection when the signature
// does not match (wrong key used to sign).
func TestWebhookHandler_InvalidSignature(t *testing.T) {
	client := New(LemonSqueezyConfig{WebhookKey: "correct-key"})
	payload := []byte(`{"meta":{"event_name":"subscription_created"},"data":{"attributes":{}}}`)

	// Produce a valid HMAC signature but with the wrong key.
	h := hmac.New(sha256.New, []byte("wrong-key"))
	h.Write(payload)
	wrongSig := "sha256=" + hex.EncodeToString(h.Sum(nil))

	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewReader(payload))
	req.Header.Set("X-Signature", wrongSig)
	w := httptest.NewRecorder()

	err := client.WebhookHandler(w, req)
	if err == nil {
		t.Error("expected error for invalid webhook signature")
	}
	if !strings.Contains(err.Error(), "invalid webhook signature") {
		t.Errorf("expected 'invalid webhook signature' in error, got: %v", err)
	}
}

// TestWebhookHandler_MalformedBody verifies that a valid signature over
// malformed JSON still returns a parse error.
func TestWebhookHandler_MalformedBody(t *testing.T) {
	key := "test-key"
	client := New(LemonSqueezyConfig{WebhookKey: key})
	payload := []byte(`{bad json`)
	w, req := webhookRequest(t, key, payload)

	err := client.WebhookHandler(w, req)
	if err == nil {
		t.Error("expected error for malformed JSON body")
	}
}

// TestWebhookHandler_BodyReadError verifies that an io.ReadAll failure inside
// WebhookHandler returns a wrapped error.
func TestWebhookHandler_BodyReadError(t *testing.T) {
	client := New(LemonSqueezyConfig{WebhookKey: "key"})
	req := httptest.NewRequest(http.MethodPost, "/webhook", nil)
	// Replace the body with a reader that immediately errors.
	req.Body = io.NopCloser(&errReader{msg: "simulated read failure"})
	w := httptest.NewRecorder()

	err := client.WebhookHandler(w, req)
	if err == nil {
		t.Error("expected error when body read fails")
	}
	if !strings.Contains(err.Error(), "failed to read request body") {
		t.Errorf("expected 'failed to read request body' in error, got: %v", err)
	}
}

// TestWebhookHandler_PutMethodRejected verifies that a PUT request returns an
// error (method guard fires before any body processing).
func TestWebhookHandler_PutMethodRejected(t *testing.T) {
	client := New(LemonSqueezyConfig{WebhookKey: "key"})
	req := httptest.NewRequest(http.MethodPut, "/webhook", nil)
	w := httptest.NewRecorder()

	err := client.WebhookHandler(w, req)
	if err == nil {
		t.Error("expected error for PUT method")
	}
	if !strings.Contains(err.Error(), "invalid HTTP method") {
		t.Errorf("expected 'invalid HTTP method' in error, got: %v", err)
	}
}
