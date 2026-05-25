package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/pipeline"
)

// BatchStreamHandler handles streaming CSV batch screening.
type BatchStreamHandler struct {
	streamer *pipeline.BatchStreamer
}

// NewBatchStreamHandler creates a handler for streaming batch screening.
func NewBatchStreamHandler(s *pipeline.BatchStreamer) *BatchStreamHandler {
	return &BatchStreamHandler{streamer: s}
}

// StreamBatch accepts CSV upload and streams results via SSE.
func (bsh *BatchStreamHandler) StreamBatch(w http.ResponseWriter, r *http.Request) {
	if bsh.streamer == nil {
		Error(w, "NOT_CONFIGURED", "batch streaming not available", http.StatusServiceUnavailable)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		Error(w, "STREAMING_ERROR", "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Minute)
	defer cancel()

	callback := func(result pipeline.BatchResult) {
		data, err := json.Marshal(result)
		if err != nil {
			log.Printf("batch stream marshal: %v", err)
			return
		}
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	progress, err := bsh.streamer.StreamCSV(ctx, r.Body, callback)
	if err != nil {
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
		flusher.Flush()
		return
	}

	summary := map[string]int64{
		"processed": progress.Processed.Load(),
		"matched":   progress.Matched.Load(),
		"clean":     progress.Clean.Load(),
		"errors":    progress.Errors.Load(),
	}
	data, _ := json.Marshal(summary)
	fmt.Fprintf(w, "event: done\ndata: %s\n\n", data)
	flusher.Flush()
}
