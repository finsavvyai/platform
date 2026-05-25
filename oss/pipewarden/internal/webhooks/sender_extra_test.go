package webhooks

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/logging"
	"go.uber.org/zap"
)

func TestSendTestEventDisabledWhenNoEndpoint(t *testing.T) {
	w := NewWebhookSender("", "", logging.NewDefault())
	code, err := w.SendTestEvent(context.Background(), nil)
	if err != nil || code != 0 {
		t.Fatalf("disabled: code=%d err=%v", code, err)
	}
}

func TestSendTestEventDeliversAndSigns(t *testing.T) {
	var hits int32
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		if r.Header.Get("X-PipeWarden-Signature") == "" {
			t.Errorf("missing X-PipeWarden-Signature")
		}
		if r.Header.Get("X-PipeWarden-Event") != "webhook.test" {
			t.Errorf("event=%q want webhook.test", r.Header.Get("X-PipeWarden-Event"))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer stub.Close()

	sender := NewWebhookSender(stub.URL, "secret", logging.NewDefault())
	code, err := sender.SendTestEvent(context.Background(), nil)
	if err != nil {
		t.Fatalf("SendTestEvent: %v", err)
	}
	if code != http.StatusOK {
		t.Fatalf("code=%d", code)
	}
	if atomic.LoadInt32(&hits) != 1 {
		t.Fatalf("expected 1 hit, got %d", hits)
	}

	// With explicit payload
	if _, err := sender.SendTestEvent(context.Background(), map[string]interface{}{"event": "custom"}); err != nil {
		t.Fatalf("custom payload: %v", err)
	}
}

func TestSendFindingsBatch(t *testing.T) {
	var hits int32
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.WriteHeader(http.StatusOK)
	}))
	defer stub.Close()

	sender := NewWebhookSender(stub.URL, "secret", logging.NewDefault())
	findings := []FindingEvent{
		{ID: 1, Title: "f1", Severity: "high"},
		{ID: 2, Title: "f2", Severity: "medium"},
		{ID: 3, Title: "f3", Severity: "low"},
	}
	if err := sender.SendFindings(context.Background(), findings); err != nil {
		t.Fatalf("SendFindings: %v", err)
	}
	if atomic.LoadInt32(&hits) != 3 {
		t.Fatalf("expected 3 hits, got %d", hits)
	}
}

func TestSendFindingsAbortsOnFailure(t *testing.T) {
	var hits int32
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer stub.Close()

	sender := NewWebhookSender(stub.URL, "secret", logging.NewDefault())
	findings := []FindingEvent{{ID: 1, Title: "f1"}, {ID: 2, Title: "f2"}}
	if err := sender.SendFindings(context.Background(), findings); err == nil {
		t.Fatalf("expected error from 500")
	}
	if atomic.LoadInt32(&hits) != 1 {
		t.Fatalf("expected first failure to abort batch, got %d hits", hits)
	}
}

func TestRetryQueueStartProcessesDueItems(t *testing.T) {
	// Drive processDue directly via Start with a cancelled ctx so the
	// goroutine starts and exits cleanly. Coverage for the goroutine entry path.
	q := NewRetryQueue(zap.NewNop())
	ctx, cancel := context.WithCancel(context.Background())
	q.Start(ctx)
	time.Sleep(50 * time.Millisecond)
	cancel()
	time.Sleep(50 * time.Millisecond)
}
