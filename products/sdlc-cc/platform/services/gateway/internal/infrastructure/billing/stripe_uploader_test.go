package billing

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestStripeUploader_Success_RequestShape(t *testing.T) {
	var capturedAuth, capturedIdem string
	var capturedForm url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/subscription_items/si_123/usage_records" {
			t.Errorf("path: %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("method: %s", r.Method)
		}
		capturedAuth = r.Header.Get("Authorization")
		capturedIdem = r.Header.Get("Idempotency-Key")
		_ = r.ParseForm()
		capturedForm = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"mbur_123","object":"usage_record","quantity":42}`))
	}))
	defer srv.Close()

	su := NewStripeUploader("sk_test_xyz", srv.URL)
	ts := time.Unix(1700000000, 0)
	ctx := WithIdempotencyKey(context.Background(), "invoice-2026-04")
	if err := su.Upload(ctx, "si_123", 42, ts); err != nil {
		t.Fatalf("upload: %v", err)
	}
	if !strings.HasPrefix(capturedAuth, "Basic ") {
		t.Fatalf("auth: %q", capturedAuth)
	}
	if capturedIdem != "invoice-2026-04" {
		t.Fatalf("idempotency: %q", capturedIdem)
	}
	if capturedForm.Get("quantity") != "42" {
		t.Fatalf("quantity: %q", capturedForm.Get("quantity"))
	}
	if capturedForm.Get("timestamp") != "1700000000" {
		t.Fatalf("timestamp: %q", capturedForm.Get("timestamp"))
	}
	if capturedForm.Get("action") != "increment" {
		t.Fatalf("action: %q", capturedForm.Get("action"))
	}
}

func TestStripeUploader_401_AuthError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"type":"invalid_request_error","code":"api_key_invalid","message":"Invalid API Key"}}`))
	}))
	defer srv.Close()
	su := NewStripeUploader("bad", srv.URL)
	err := su.Upload(context.Background(), "si_1", 1, time.Now())
	if err == nil {
		t.Fatal("expected err")
	}
	var se *StripeError
	if !errors.As(err, &se) {
		t.Fatalf("want *StripeError; got %T %v", err, err)
	}
	if !se.IsAuth() {
		t.Fatalf("not auth: %+v", se)
	}
	if se.Code != "api_key_invalid" {
		t.Fatalf("code: %q", se.Code)
	}
}

func TestStripeUploader_429_RetryAfter(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Retry-After", "12")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"error":{"type":"rate_limit","message":"Too many requests"}}`))
	}))
	defer srv.Close()
	su := NewStripeUploader("sk", srv.URL)
	err := su.Upload(context.Background(), "si", 1, time.Now())
	var se *StripeError
	if !errors.As(err, &se) {
		t.Fatalf("want *StripeError; got %T %v", err, err)
	}
	if !se.IsRateLimited() {
		t.Fatalf("not rate-limited: %+v", se)
	}
	if se.RetryAfter != 12*time.Second {
		t.Fatalf("retry-after: %v", se.RetryAfter)
	}
}

func TestStripeUploader_Malformed_SafeError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`<html>not json</html>`))
	}))
	defer srv.Close()
	su := NewStripeUploader("sk", srv.URL)
	err := su.Upload(context.Background(), "si", 1, time.Now())
	var se *StripeError
	if !errors.As(err, &se) {
		t.Fatalf("want *StripeError; got %T %v", err, err)
	}
	if se.StatusCode != 500 {
		t.Fatalf("status: %d", se.StatusCode)
	}
	if !strings.Contains(se.Message, "non-2xx") {
		t.Fatalf("message: %q", se.Message)
	}
}

func TestStripeUploader_NoIdempotencyKey_OmitsHeader(t *testing.T) {
	var hadIdem string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hadIdem = r.Header.Get("Idempotency-Key")
		_, _ = w.Write([]byte(`{"id":"mbur"}`))
	}))
	defer srv.Close()
	su := NewStripeUploader("sk", srv.URL)
	if err := su.Upload(context.Background(), "si", 1, time.Now()); err != nil {
		t.Fatalf("upload: %v", err)
	}
	if hadIdem != "" {
		t.Fatalf("idempotency header should be absent: %q", hadIdem)
	}
}

func TestStripeUploader_EmptySubscriptionItem(t *testing.T) {
	su := NewStripeUploader("sk", "http://unused")
	err := su.Upload(context.Background(), "", 1, time.Now())
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "empty subscription_item_id") {
		t.Fatalf("err: %v", err)
	}
}

func TestNoopUploader_Upload(t *testing.T) {
	n := &NoopUploader{Logger: nil}
	if err := n.Upload(context.Background(), &Invoice{}); err != nil {
		t.Fatalf("noop: %v", err)
	}
}

func TestNoopUploader_Upload_WithLogger(t *testing.T) {
	var logged bool
	n := &NoopUploader{Logger: &captureLogger{fn: func() { logged = true }}}
	if err := n.Upload(context.Background(), &Invoice{}); err != nil {
		t.Fatalf("noop with logger: %v", err)
	}
	if !logged {
		t.Fatal("expected Logger.Printf to be called")
	}
}

type captureLogger struct{ fn func() }

func (c *captureLogger) Printf(_ string, _ ...any) { c.fn() }

func TestStripeError_ErrorString(t *testing.T) {
	e := &StripeError{StatusCode: 402, Type: "card_error", Code: "insufficient_funds", Message: "Your card has insufficient funds."}
	s := e.Error()
	if s == "" {
		t.Fatal("Error() should return non-empty string")
	}
}

func TestNewStripeUploader_DefaultBaseURL(t *testing.T) {
	su := NewStripeUploader("sk_test", "")
	if su.baseURL != "https://api.stripe.com" {
		t.Fatalf("default base URL: %q", su.baseURL)
	}
}
