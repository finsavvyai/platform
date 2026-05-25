package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// StreamScanProgress handles GET /api/v1/scan/{runID}/progress.
// It streams ProgressEvent JSON objects as Server-Sent Events until the
// scan completes, the client disconnects, or a keepalive timeout occurs.
func (h *Handlers) StreamScanProgress(w http.ResponseWriter, r *http.Request) {
	runID := strings.TrimPrefix(r.URL.Path, "/api/v1/scan/")
	runID = strings.TrimSuffix(runID, "/progress")
	if runID == "" {
		http.Error(w, "missing runID", http.StatusBadRequest)
		return
	}

	if h.ProgressRegistry == nil {
		http.Error(w, "SSE not available", http.StatusInternalServerError)
		return
	}

	ch := h.ProgressRegistry.lookup(runID)
	if ch == nil {
		http.Error(w, "run not found", http.StatusNotFound)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	flusher, canFlush := w.(http.Flusher)

	keepalive := time.NewTicker(15 * time.Second)
	defer keepalive.Stop()

	for {
		select {
		case <-r.Context().Done():
			return

		case <-keepalive.C:
			_, _ = fmt.Fprint(w, ": keepalive\n\n")
			if canFlush {
				flusher.Flush()
			}

		case event, open := <-ch:
			if !open {
				return
			}
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
			if canFlush {
				flusher.Flush()
			}
			if event.Stage == "complete" || event.Stage == "error" {
				return
			}
		}
	}
}

// lookup returns a receive channel for the runID without registering a new one.
func (r *ScanProgressRegistry) lookup(runID string) <-chan ProgressEvent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ch, ok := r.chans[runID]
	if !ok {
		return nil
	}
	return ch
}
