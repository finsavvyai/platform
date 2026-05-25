package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/finsavvyai/sdlc-core/ai"
	"github.com/finsavvyai/sdlc-core/dlp"
)

// HandleMessagesStream emits a DLP-scrubbed completion as the SSE
// event sequence Claude Code's parser expects:
//
//   event: message_start
//   event: content_block_start
//   event: content_block_delta
//   event: content_block_stop
//   event: message_stop
//
// Buffer-then-scrub-then-emit. True per-token streaming would risk
// emitting a partial PAN before the regex saw enough context to
// redact it. TTFB ≈ provider latency (~1-3s for Haiku); Claude Code
// accepts the pause and renders the full answer at once.
func HandleMessagesStream(provider ai.Provider) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req MessagesRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeErr(w, "BAD_REQUEST", "invalid body", http.StatusBadRequest)
			return
		}
		streamWithRequest(provider, req, w, r)
	}
}

// streamWithRequest is the inner streaming logic. Split out so that
// HandleMessages can route to streaming WITHOUT re-decoding the body
// (HandleMessages already consumed it). Direct callers continue to
// use HandleMessagesStream which decodes first.
func streamWithRequest(provider ai.Provider, req MessagesRequest, w http.ResponseWriter, r *http.Request) {
	{
		prompt, err := buildPrompt(req)
		if err != nil {
			writeErr(w, "BAD_REQUEST", err.Error(), http.StatusBadRequest)
			return
		}
		if !provider.IsConfigured() {
			writeErr(w, "AI_UNAVAILABLE",
				"no provider configured",
				http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		flusher, _ := w.(http.Flusher)

		text, err := provider.Complete(r.Context(), prompt)
		if err != nil {
			emitSSE(w, flusher, "error", map[string]interface{}{
				"type": "error",
				"error": map[string]string{
					"type":    "api_error",
					"message": err.Error(),
				},
			})
			return
		}
		scrubbed := dlp.MaskAML(text)
		id := fmt.Sprintf("msg_sdlc_%d", time.Now().UnixNano())
		emitSSE(w, flusher, "message_start", map[string]interface{}{
			"type": "message_start",
			"message": map[string]interface{}{
				"id": id, "type": "message", "role": "assistant",
				"model": defaultModel(req.Model),
			},
		})
		emitSSE(w, flusher, "content_block_start", map[string]interface{}{
			"type": "content_block_start", "index": 0,
			"content_block": map[string]interface{}{"type": "text", "text": ""},
		})
		emitSSE(w, flusher, "content_block_delta", map[string]interface{}{
			"type": "content_block_delta", "index": 0,
			"delta": map[string]interface{}{"type": "text_delta", "text": scrubbed},
		})
		emitSSE(w, flusher, "content_block_stop", map[string]interface{}{
			"type": "content_block_stop", "index": 0,
		})
		emitSSE(w, flusher, "message_stop", map[string]interface{}{
			"type": "message_stop",
		})
	}
}

func emitSSE(w http.ResponseWriter, flusher http.Flusher, event string, payload interface{}) {
	data, _ := json.Marshal(payload)
	_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
	if flusher != nil {
		flusher.Flush()
	}
}
