package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/billing"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func TestCreateCheckoutSession_Valid(t *testing.T) {
	h := newPaymentTestHandlers(t)

	req := CheckoutRequest{Plan: "starter"}
	body, _ := json.Marshal(req)
	httpReq := httptest.NewRequest("POST", "/api/v1/billing/checkout", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.CreateCheckoutSession(w, httpReq)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	_ = json.NewDecoder(w.Body).Decode(&resp)
	if _, exists := resp["session_id"]; !exists {
		t.Error("expected session_id in response")
	}
}

func TestCreateCheckoutSession_MissingPlan(t *testing.T) {
	h := newPaymentTestHandlers(t)

	req := CheckoutRequest{}
	body, _ := json.Marshal(req)
	httpReq := httptest.NewRequest("POST", "/api/v1/billing/checkout", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.CreateCheckoutSession(w, httpReq)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestCreateCheckoutSession_InvalidPlan(t *testing.T) {
	h := newPaymentTestHandlers(t)

	req := CheckoutRequest{Plan: "ultra-mega"}
	body, _ := json.Marshal(req)
	httpReq := httptest.NewRequest("POST", "/api/v1/billing/checkout", bytes.NewReader(body))
	w := httptest.NewRecorder()

	h.CreateCheckoutSession(w, httpReq)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleBillingWebhook_MissingSignature(t *testing.T) {
	h := newPaymentTestHandlers(t)

	httpReq := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewReader([]byte("{}")))
	w := httptest.NewRecorder()

	h.HandleBillingWebhook(w, httpReq)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestHandleBillingWebhook_InvalidSignature(t *testing.T) {
	h := newPaymentTestHandlers(t)

	httpReq := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewReader([]byte("{}")))
	httpReq.Header.Set("X-Signature", "bad-sig")
	w := httptest.NewRecorder()

	h.HandleBillingWebhook(w, httpReq)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestHandleBillingWebhook_ValidSignature(t *testing.T) {
	h := newPaymentTestHandlers(t)

	payload := []byte(`{"meta":{"event_name":"subscription_created","custom_data":{"tenant_id":"tenant-123"}},"data":{"attributes":{"status":"active"}}}`)
	mac := hmac.New(sha256.New, []byte("webhook-secret"))
	mac.Write(payload)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	httpReq := httptest.NewRequest("POST", "/api/v1/billing/webhook", bytes.NewReader(payload))
	httpReq.Header.Set("X-Signature", sig)
	w := httptest.NewRecorder()

	h.HandleBillingWebhook(w, httpReq)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func newPaymentTestHandlers(t *testing.T) *Handlers {
	t.Helper()

	db, err := storage.New(":memory:")
	if err != nil {
		t.Fatalf("failed to create test DB: %v", err)
	}

	logger := logging.NewDefault()

	return &Handlers{
		db:            db,
		logger:        logger,
		billingClient: billing.New(billing.LemonSqueezyConfig{WebhookKey: "webhook-secret"}),
	}
}
