package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/security"
)

// streamAnthropicResponse emits a DLP-scrubbed completion as the
// SSE event sequence Claude Code's parser expects:
//
//   event: message_start          (id, model, role)
//   event: content_block_start    (index, type=text)
//   event: content_block_delta    (index, scrubbed text)
//   event: content_block_stop     (index)
//   event: message_stop
//
// We emit one big delta after running MaskAML on the full provider
// response — buffer-then-scrub-then-emit is the compliance-correct
// trade-off. True per-token streaming would risk emitting a partial
// PAN before the regex saw enough context to redact it.
//
// TTFB is therefore equal to provider latency (~1-3s for Haiku).
// Claude Code accepts this; users see a "thinking" pause then the
// full answer arrive at once. Real streaming is roadmap.
func streamAnthropicResponse(ctx context.Context, w http.ResponseWriter, deps aiHandlerDeps, claims *Claims, prompt, model, summaryType string) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, _ := w.(http.Flusher)

	started := time.Now()
	text, err := deps.client.Complete(ctx, prompt)
	latency := time.Since(started)
	provider := providerNameOf(deps.client)

	if err != nil {
		recordAIRequest(deps.reqLog, buildErrorLog(claims.TenantID,
			claims.UserID, provider, model, summaryType, prompt,
			classifyError(err), latency))
		emitSSEError(w, flusher, err)
		return
	}

	scrubbed := security.MaskAML(text)
	id := fmt.Sprintf("msg_aegis_%d", time.Now().UnixNano())
	emitSSE(w, flusher, "message_start", map[string]interface{}{
		"type": "message_start",
		"message": map[string]interface{}{
			"id": id, "type": "message", "role": "assistant",
			"model": model,
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

	recordAIRequest(deps.reqLog, buildSuccessLog(claims.TenantID,
		claims.UserID, provider, model, summaryType,
		prompt, scrubbed, latency, false))
	cacheSet(deps.cache, claims.TenantID, prompt, scrubbed)
}

// emitSSE writes one event line + JSON data line + blank separator.
func emitSSE(w http.ResponseWriter, flusher http.Flusher, event string, payload interface{}) {
	data, _ := json.Marshal(payload)
	_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, data)
	if flusher != nil {
		flusher.Flush()
	}
}

// emitSSEError writes an Anthropic-shaped error event.
func emitSSEError(w http.ResponseWriter, flusher http.Flusher, err error) {
	emitSSE(w, flusher, "error", map[string]interface{}{
		"type": "error",
		"error": map[string]interface{}{
			"type": "api_error", "message": classifyError(err),
		},
	})
}
