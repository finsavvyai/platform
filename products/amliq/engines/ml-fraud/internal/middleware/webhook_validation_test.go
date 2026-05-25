package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

const testWebhookSecret = "test-webhook-secret-key-2026"

func signWebhook(body string, ts int64, secret string) string {
	payload := fmt.Sprintf("%d.%s", ts, body)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func webhookHandler() http.Handler {
	return WebhookValidationWithSecret(testWebhookSecret)(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	)
}

func TestWebhookValidation_ValidSignature(t *testing.T) {
	body := `{"event":"payment.completed","id":"pay_123"}`
	ts := time.Now().Unix()
	sig := signWebhook(body, ts, testWebhookSecret)

	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", strings.NewReader(body))
	req.Header.Set(WebhookSignatureHeader, sig)
	req.Header.Set(WebhookTimestampHeader, fmt.Sprintf("%d", ts))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	webhookHandler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestWebhookValidation_MissingSignature(t *testing.T) {
	body := `{"event":"test"}`
	ts := time.Now().Unix()

	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", strings.NewReader(body))
	req.Header.Set(WebhookTimestampHeader, fmt.Sprintf("%d", ts))

	w := httptest.NewRecorder()
	webhookHandler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestWebhookValidation_InvalidSignature(t *testing.T) {
	body := `{"event":"test"}`
	ts := time.Now().Unix()

	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", strings.NewReader(body))
	req.Header.Set(WebhookSignatureHeader, "deadbeef")
	req.Header.Set(WebhookTimestampHeader, fmt.Sprintf("%d", ts))

	w := httptest.NewRecorder()
	webhookHandler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestWebhookValidation_WrongSecret(t *testing.T) {
	body := `{"event":"test"}`
	ts := time.Now().Unix()
	sig := signWebhook(body, ts, "wrong-secret")

	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", strings.NewReader(body))
	req.Header.Set(WebhookSignatureHeader, sig)
	req.Header.Set(WebhookTimestampHeader, fmt.Sprintf("%d", ts))

	w := httptest.NewRecorder()
	webhookHandler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestWebhookValidation_ExpiredTimestamp(t *testing.T) {
	body := `{"event":"test"}`
	ts := time.Now().Add(-10 * time.Minute).Unix()
	sig := signWebhook(body, ts, testWebhookSecret)

	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", strings.NewReader(body))
	req.Header.Set(WebhookSignatureHeader, sig)
	req.Header.Set(WebhookTimestampHeader, fmt.Sprintf("%d", ts))

	w := httptest.NewRecorder()
	webhookHandler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestWebhookValidation_MissingTimestamp(t *testing.T) {
	body := `{"event":"test"}`

	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", strings.NewReader(body))
	req.Header.Set(WebhookSignatureHeader, "somesig")

	w := httptest.NewRecorder()
	webhookHandler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestWebhookValidation_InvalidJSON(t *testing.T) {
	body := `not json at all`
	ts := time.Now().Unix()
	sig := signWebhook(body, ts, testWebhookSecret)

	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", strings.NewReader(body))
	req.Header.Set(WebhookSignatureHeader, sig)
	req.Header.Set(WebhookTimestampHeader, fmt.Sprintf("%d", ts))

	w := httptest.NewRecorder()
	webhookHandler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestWebhookValidation_EmptySecret(t *testing.T) {
	handler := WebhookValidationWithSecret("")(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	)

	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", strings.NewReader(`{}`))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestWebhookValidation_FutureTimestamp(t *testing.T) {
	body := `{"event":"test"}`
	ts := time.Now().Add(10 * time.Minute).Unix()
	sig := signWebhook(body, ts, testWebhookSecret)

	req := httptest.NewRequest(http.MethodPost, "/webhooks/payment", strings.NewReader(body))
	req.Header.Set(WebhookSignatureHeader, sig)
	req.Header.Set(WebhookTimestampHeader, fmt.Sprintf("%d", ts))

	w := httptest.NewRecorder()
	webhookHandler().ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}
