package ingestion

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestResilientFetcher(t *testing.T) {
	tests := []struct {
		name      string
		handler   func() http.Handler
		wantErr   bool
		wantData  string
	}{
		{
			name: "retry_succeeds_on_third_attempt",
			handler: func() http.Handler {
				var count atomic.Int32
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if count.Add(1) < 3 {
						w.WriteHeader(500)
						return
					}
					w.Write([]byte("ok"))
				})
			},
			wantErr:  false,
			wantData: "ok",
		},
		{
			name: "etag_304_not_modified",
			handler: func() http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("ETag", `"abc123"`)
					w.WriteHeader(http.StatusNotModified)
				})
			},
			wantErr:  false,
			wantData: "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(tt.handler())
			defer srv.Close()

			rf := NewResilientFetcher()
			rf.backoff = 1 * time.Millisecond
			data, _, err := rf.Fetch(context.Background(), srv.URL)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err=%v, wantErr=%v", err, tt.wantErr)
			}
			if string(data) != tt.wantData {
				t.Fatalf("data=%q, want=%q", data, tt.wantData)
			}
		})
	}
}

func TestCircuitBreaker(t *testing.T) {
	tests := []struct {
		name     string
		failures int
		cooldown time.Duration
		wait     time.Duration
		wantOpen bool
	}{
		{name: "opens_after_threshold", failures: 5, cooldown: time.Minute, wantOpen: true},
		{name: "below_threshold", failures: 3, cooldown: time.Minute, wantOpen: false},
		{name: "resets_after_cooldown", failures: 5, cooldown: 10 * time.Millisecond,
			wait: 20 * time.Millisecond, wantOpen: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cb := NewCircuitBreaker(5, tt.cooldown)
			for i := 0; i < tt.failures; i++ {
				cb.recordFailure()
			}
			if tt.wait > 0 {
				time.Sleep(tt.wait)
			}
			if got := cb.IsOpen(); got != tt.wantOpen {
				t.Fatalf("IsOpen()=%v, want=%v", got, tt.wantOpen)
			}
		})
	}
}
