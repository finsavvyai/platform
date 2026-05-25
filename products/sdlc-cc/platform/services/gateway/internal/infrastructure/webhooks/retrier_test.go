package webhooks

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

type fakeDLQ struct {
	mu      sync.Mutex
	entries []DLQEntry
}

func (f *fakeDLQ) Push(_ context.Context, e DLQEntry) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.entries = append(f.entries, e)
	return nil
}

func newTestRetrier(dlq *fakeDLQ) *Retrier {
	r := NewRetrier(dlq)
	// Collapse delays so the test runs in milliseconds.
	r.Delays = []time.Duration{0, 0, 0, 0, 0}
	r.Sleep = func(time.Duration) {}
	return r
}

func TestRetrier_5xx_RetriesThenSucceeds(t *testing.T) {
	var attempts int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		attempts++
		if attempts < 3 {
			http.Error(w, "boom", http.StatusBadGateway)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	dlq := &fakeDLQ{}
	r := newTestRetrier(dlq)
	err := r.Deliver(context.Background(),
		Endpoint{ID: "ep1", URL: srv.URL, TenantID: "t1"},
		[]byte(`{"x":1}`),
		SignedHeaders{Timestamp: "1700000000", Nonce: "n", Signature: "s"},
	)
	if err != nil {
		t.Fatalf("expected eventual success, got %v", err)
	}
	if attempts != 3 {
		t.Fatalf("attempts: %d", attempts)
	}
	if len(dlq.entries) != 0 {
		t.Fatalf("dlq should be empty on success: %+v", dlq.entries)
	}
}

func TestRetrier_FiveFailures_GoesToDLQ(t *testing.T) {
	var attempts int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		attempts++
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()
	dlq := &fakeDLQ{}
	r := newTestRetrier(dlq)
	err := r.Deliver(context.Background(),
		Endpoint{ID: "ep2", URL: srv.URL, TenantID: "t2"},
		[]byte(`{"x":2}`),
		SignedHeaders{Timestamp: "t", Nonce: "n", Signature: "sig"},
	)
	if err == nil {
		t.Fatal("expected terminal error")
	}
	if attempts != 5 {
		t.Fatalf("expected 5 attempts; got %d", attempts)
	}
	if len(dlq.entries) != 1 {
		t.Fatalf("dlq entries: %d", len(dlq.entries))
	}
	if dlq.entries[0].EndpointID != "ep2" || dlq.entries[0].Attempts != 5 {
		t.Fatalf("dlq entry: %+v", dlq.entries[0])
	}
	if dlq.entries[0].LastStatus != 500 {
		t.Fatalf("last status: %d", dlq.entries[0].LastStatus)
	}
}

func TestRetrier_4xx_NoRetry_PermanentDLQ(t *testing.T) {
	var attempts int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		attempts++
		http.Error(w, "bad", http.StatusBadRequest)
	}))
	defer srv.Close()
	dlq := &fakeDLQ{}
	r := newTestRetrier(dlq)
	err := r.Deliver(context.Background(),
		Endpoint{ID: "ep3", URL: srv.URL, TenantID: "t3"},
		[]byte(`{"x":3}`),
		SignedHeaders{Timestamp: "t", Nonce: "n", Signature: "sig"},
	)
	if err == nil {
		t.Fatal("expected error")
	}
	if !errors.Is(err, ErrPermanent) {
		t.Fatalf("expected ErrPermanent; got %v", err)
	}
	if attempts != 1 {
		t.Fatalf("4xx must not retry; got attempts=%d", attempts)
	}
	if len(dlq.entries) != 1 {
		t.Fatalf("permanent failure must DLQ; got %d entries", len(dlq.entries))
	}
}

func TestRetrier_PropagatesSignatureHeader(t *testing.T) {
	var seen SignedHeaders
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = HeadersFromRequest(r)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	dlq := &fakeDLQ{}
	r := newTestRetrier(dlq)
	want := SignedHeaders{Timestamp: "1700", Nonce: "abc", Signature: "deadbeef"}
	err := r.Deliver(context.Background(),
		Endpoint{ID: "ep4", URL: srv.URL, TenantID: "t4"},
		[]byte(`{}`), want,
	)
	if err != nil {
		t.Fatalf("deliver: %v", err)
	}
	if seen != want {
		t.Fatalf("headers not propagated: %+v vs want %+v", seen, want)
	}
}

func TestRetrier_NetworkError_RetriesThenDLQ(t *testing.T) {
	dlq := &fakeDLQ{}
	r := newTestRetrier(dlq)
	// Unreachable URL causes transport error every attempt.
	err := r.Deliver(context.Background(),
		Endpoint{ID: "ep5", URL: "http://127.0.0.1:1/", TenantID: "t5"},
		[]byte(`{}`),
		SignedHeaders{Timestamp: "t", Nonce: "n", Signature: "s"},
	)
	if err == nil {
		t.Fatal("expected error")
	}
	if len(dlq.entries) != 1 {
		t.Fatalf("dlq entries: %d", len(dlq.entries))
	}
}
