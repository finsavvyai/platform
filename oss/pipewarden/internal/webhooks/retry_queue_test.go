package webhooks

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"go.uber.org/zap"
)

func newTestLogger() *zap.Logger {
	logger, _ := zap.NewDevelopment()
	return logger
}

// TestRetryQueueDelivery verifies eventual delivery after 2 initial failures.
func TestRetryQueueDelivery(t *testing.T) {
	var callCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&callCount, 1)
		if n < 3 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	q := NewRetryQueue(newTestLogger())
	q.Enqueue(server.URL, []byte(`{"event":"test"}`), "secret")

	// Manually drive delivery until success or 5 attempts
	delivered := false
	for i := 0; i < 5 && !delivered; i++ {
		q.mu.Lock()
		if len(q.pending) == 0 {
			q.mu.Unlock()
			delivered = true
			break
		}
		item := q.pending[0]
		item.nextRetry = time.Now() // make it due immediately
		q.mu.Unlock()

		q.processDue()

		q.mu.Lock()
		empty := len(q.pending) == 0
		q.mu.Unlock()
		if empty {
			delivered = true
		}
	}

	if !delivered {
		t.Fatal("expected item to be delivered after retries, but it was not")
	}
	if atomic.LoadInt32(&callCount) < 3 {
		t.Errorf("expected at least 3 calls (2 failures + 1 success), got %d", callCount)
	}
}

// TestRetryQueueMaxRetries verifies items are dropped after maxRetries attempts.
func TestRetryQueueMaxRetries(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	q := NewRetryQueue(newTestLogger())
	q.Enqueue(server.URL, []byte(`{"event":"fail"}`), "secret")

	// Drive processDue maxRetries times, resetting nextRetry each time
	for i := 0; i < maxRetries+1; i++ {
		q.mu.Lock()
		for _, item := range q.pending {
			item.nextRetry = time.Now()
		}
		q.mu.Unlock()
		q.processDue()
	}

	q.mu.Lock()
	remaining := len(q.pending)
	q.mu.Unlock()

	if remaining != 0 {
		t.Errorf("expected item to be dropped after %d retries, %d still pending", maxRetries, remaining)
	}
}

// TestRetryQueueBackoffTiming verifies nextRetry follows the exponential schedule.
func TestRetryQueueBackoffTiming(t *testing.T) {
	// Use an always-failing server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	q := NewRetryQueue(newTestLogger())
	q.Enqueue(server.URL, []byte(`{}`), "secret")

	for attempt := 0; attempt < len(backoffDurations); attempt++ {
		q.mu.Lock()
		if len(q.pending) == 0 {
			q.mu.Unlock()
			break
		}
		item := q.pending[0]
		item.nextRetry = time.Now() // make due
		q.mu.Unlock()

		before := time.Now()
		q.processDue()

		q.mu.Lock()
		if len(q.pending) == 0 {
			q.mu.Unlock()
			break
		}
		next := q.pending[0].nextRetry
		q.mu.Unlock()

		want := backoffDurations[attempt]
		got := next.Sub(before)

		// Allow ±2 seconds tolerance for test execution time
		if got < want-2*time.Second || got > want+2*time.Second {
			t.Errorf("attempt %d: expected nextRetry ~%v from now, got %v", attempt+1, want, got)
		}
	}
}
