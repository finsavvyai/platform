package ingestion

import (
	"context"
	"log"
	"net/http"
	"sync"
	"time"
)

// ListWatcher monitors a sanctions list URL for changes via ETag/Last-Modified.
type ListWatcher struct {
	ListID       string
	URL          string
	Interval     time.Duration
	client       *http.Client
	mu           sync.Mutex
	lastETag     string
	lastModified string
	changed      bool
	callbacks    []func(listID string, newData []byte)
}

// NewListWatcher creates a watcher with the given check interval.
func NewListWatcher(listID, url string, interval time.Duration) *ListWatcher {
	if interval == 0 {
		interval = 15 * time.Minute
	}
	return &ListWatcher{
		ListID:   listID,
		URL:      url,
		Interval: interval,
		client:   &http.Client{Timeout: 30 * time.Second},
	}
}

// OnChange registers a callback invoked when the list changes.
func (lw *ListWatcher) OnChange(cb func(listID string, newData []byte)) {
	lw.mu.Lock()
	defer lw.mu.Unlock()
	lw.callbacks = append(lw.callbacks, cb)
}

// HasChanged returns true if the last check detected a change.
func (lw *ListWatcher) HasChanged() bool {
	lw.mu.Lock()
	defer lw.mu.Unlock()
	return lw.changed
}

// Watch periodically checks the URL for changes until ctx is cancelled.
func (lw *ListWatcher) Watch(ctx context.Context) {
	ticker := time.NewTicker(lw.Interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			lw.check()
		}
	}
}

// check performs a HEAD request and compares ETag/Last-Modified.
func (lw *ListWatcher) check() {
	req, err := http.NewRequest("HEAD", lw.URL, nil)
	if err != nil {
		log.Printf("list_watcher %s: request error: %v", lw.ListID, err)
		return
	}
	resp, err := lw.client.Do(req)
	if err != nil {
		log.Printf("list_watcher %s: fetch error: %v", lw.ListID, err)
		return
	}
	defer resp.Body.Close()

	etag := resp.Header.Get("ETag")
	modified := resp.Header.Get("Last-Modified")

	lw.mu.Lock()
	defer lw.mu.Unlock()

	if lw.lastETag == "" && lw.lastModified == "" {
		lw.lastETag = etag
		lw.lastModified = modified
		lw.changed = false
		return
	}
	if etag != lw.lastETag || modified != lw.lastModified {
		lw.changed = true
		lw.lastETag = etag
		lw.lastModified = modified
		log.Printf("list_watcher %s: change detected", lw.ListID)
		for _, cb := range lw.callbacks {
			go cb(lw.ListID, nil)
		}
	}
}
