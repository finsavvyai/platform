package ingestion

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestListWatcher(t *testing.T) {
	tests := []struct {
		name        string
		etags       []string
		wantChanged bool
		wantCalls   int32
	}{
		{
			name:        "no change same etag",
			etags:       []string{"abc", "abc"},
			wantChanged: false,
			wantCalls:   0,
		},
		{
			name:        "change detected new etag",
			etags:       []string{"abc", "def"},
			wantChanged: true,
			wantCalls:   1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var reqCount int
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != "HEAD" {
					t.Errorf("expected HEAD, got %s", r.Method)
				}
				idx := reqCount
				if idx >= len(tt.etags) {
					idx = len(tt.etags) - 1
				}
				w.Header().Set("ETag", tt.etags[idx])
				reqCount++
			}))
			defer srv.Close()

			watcher := NewListWatcher("test-list", srv.URL, time.Millisecond)

			var callCount atomic.Int32
			watcher.OnChange(func(listID string, data []byte) {
				callCount.Add(1)
			})

			// First check: initializes ETag
			watcher.check()
			// Second check: compares ETag
			watcher.check()

			time.Sleep(50 * time.Millisecond) // let async callback fire

			if watcher.HasChanged() != tt.wantChanged {
				t.Errorf("HasChanged() = %v, want %v", watcher.HasChanged(), tt.wantChanged)
			}
			if callCount.Load() != tt.wantCalls {
				t.Errorf("callback count = %d, want %d", callCount.Load(), tt.wantCalls)
			}
		})
	}
}

func TestListWatcherCallbackReceivesListID(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("ETag", "v"+r.URL.Path)
	}))
	defer srv.Close()

	watcher := NewListWatcher("ofac-sdn", srv.URL+"/1", time.Millisecond)

	var receivedID atomic.Value
	watcher.OnChange(func(listID string, data []byte) {
		receivedID.Store(listID)
	})

	watcher.check()
	watcher.URL = srv.URL + "/2" // Force different ETag
	watcher.check()

	time.Sleep(50 * time.Millisecond)
	if got := receivedID.Load(); got != "ofac-sdn" {
		t.Errorf("callback listID = %v, want ofac-sdn", got)
	}
}
