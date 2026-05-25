// SSE-aware inline DLP redactor. Claude Team A2 closeout. Wraps
// the upstream Anthropic streaming response, parses each
// `content_block_delta` event as it arrives, accumulates text per
// content-block index, and emits redacted synthetic delta events
// downstream. A sliding-window safety margin holds back the trailing
// N characters until enough context arrives to decide whether they
// contain PII split across event boundaries.
//
// The redactor wraps an existing http.ResponseWriter; the
// anthropic_compat handler instantiates one per streaming request.
package middleware

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
)

// safetyMargin is the number of trailing characters held back per
// content-block until the next delta arrives or the stream ends.
// Set to fit the longest realistic match in our pattern set:
// SSH PRIVATE KEY armor + a JWT both fit in ~80 chars; 128 gives
// headroom for tenant-defined patterns without ballooning latency.
const safetyMargin = 128

// StreamRedactor sits between the upstream SSE producer and the
// downstream client. Implements io.Writer so the streaming branch
// in anthropic_compat can swap it in for the bare ResponseWriter.
type StreamRedactor struct {
	out      http.ResponseWriter
	flusher  http.Flusher
	detector *Detector
	action   Action
	extra    []pattern

	// pending holds the raw upstream bytes that haven't been parsed
	// into complete SSE events yet (events end at "\n\n").
	pending bytes.Buffer

	// buffers keeps per-content-block accumulated text that hasn't
	// been emitted yet. Indexed by Anthropic's content-block index.
	buffers map[int]string

	// closed indicates Close() ran; subsequent Write calls no-op.
	closed bool
}

// NewStreamRedactor wraps `out` with an inline-DLP filter.
// detector + action come from the chain DLP middleware. flusher is
// nil-safe — the redactor falls back to write-only when the
// underlying writer doesn't support Flush.
func NewStreamRedactor(out http.ResponseWriter, detector *Detector, action Action, extra []pattern) *StreamRedactor {
	flusher, _ := out.(http.Flusher)
	return &StreamRedactor{
		out:      out,
		flusher:  flusher,
		detector: detector,
		action:   action,
		extra:    extra,
		buffers:  make(map[int]string),
	}
}

// Write accepts upstream SSE bytes, parses out complete events, and
// emits redacted versions downstream. Always returns len(p), nil
// because partial events are buffered locally — the caller's view
// is "I sent N bytes and the redactor handled them".
func (r *StreamRedactor) Write(p []byte) (int, error) {
	if r.closed {
		return len(p), nil
	}
	r.pending.Write(p)
	for {
		raw := r.pending.Bytes()
		idx := bytes.Index(raw, []byte("\n\n"))
		if idx < 0 {
			break
		}
		event := string(raw[:idx])
		r.pending.Next(idx + 2)
		r.processEvent(event)
	}
	return len(p), nil
}

// Close flushes whatever's left in pending + per-content-block
// buffers. Call once when the upstream SSE body returns EOF.
func (r *StreamRedactor) Close() error {
	if r.closed {
		return nil
	}
	r.closed = true
	// Flush whatever's left in pending. Anthropic's stream always
	// ends with a `message_stop` event, so this is a defensive
	// drain — incomplete events get emitted verbatim.
	if r.pending.Len() > 0 {
		r.processEvent(r.pending.String())
		r.pending.Reset()
	}
	// Final flush of any buffered text per content-block.
	for idx, buf := range r.buffers {
		if buf == "" {
			continue
		}
		r.emitTextDelta(idx, r.redact(buf))
	}
	r.buffers = nil
	if r.flusher != nil {
		r.flusher.Flush()
	}
	return nil
}

// processEvent handles one complete SSE event frame
// ("event: foo\ndata: {...}"). content_block_delta with text_delta
// goes through the buffer-and-redact path; everything else is
// forwarded verbatim.
func (r *StreamRedactor) processEvent(event string) {
	if !strings.Contains(event, "content_block_delta") {
		r.emitVerbatim(event)
		return
	}
	dataLine := extractDataLine(event)
	if dataLine == "" {
		r.emitVerbatim(event)
		return
	}
	var delta struct {
		Type  string `json:"type"`
		Index int    `json:"index"`
		Delta struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"delta"`
	}
	if err := json.Unmarshal([]byte(dataLine), &delta); err != nil {
		r.emitVerbatim(event)
		return
	}
	if delta.Delta.Type != "text_delta" {
		// tool_use deltas + other shapes pass through; the chain's
		// outbound DLP handles non-streaming paths.
		r.emitVerbatim(event)
		return
	}
	// Append to the per-block buffer; emit everything except the
	// trailing safetyMargin characters so a PII match split across
	// the next event still gets caught.
	r.buffers[delta.Index] += delta.Delta.Text
	buf := r.buffers[delta.Index]
	if len(buf) <= safetyMargin {
		return
	}
	emit := buf[:len(buf)-safetyMargin]
	keep := buf[len(buf)-safetyMargin:]
	r.buffers[delta.Index] = keep
	r.emitTextDelta(delta.Index, r.redact(emit))
}

// emitTextDelta synthesizes a content_block_delta event with the
// redacted text and writes it to the downstream writer. JSON
// encoding deliberately disables HTML escaping so the redact
// placeholders (`<EMAIL>` etc.) survive as literal angle brackets
// — Anthropic SDKs parse SSE data lines as raw JSON and never
// expect Unicode escapes for `<>`.
func (r *StreamRedactor) emitTextDelta(index int, text string) {
	if text == "" {
		return
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(map[string]any{
		"type":  "content_block_delta",
		"index": index,
		"delta": map[string]any{
			"type": "text_delta",
			"text": text,
		},
	})
	// Encoder.Encode appends a trailing newline; trim before
	// wrapping in the SSE frame so we don't emit "data: {...}\n\n\n".
	payload := bytes.TrimRight(buf.Bytes(), "\n")
	frame := "event: content_block_delta\ndata: " + string(payload) + "\n\n"
	_, _ = r.out.Write([]byte(frame))
	if r.flusher != nil {
		r.flusher.Flush()
	}
}

// emitVerbatim writes the event back unchanged. Used for
// non-text-delta events (message_start, message_stop, etc.) that
// don't carry redactable content.
func (r *StreamRedactor) emitVerbatim(event string) {
	_, _ = r.out.Write([]byte(event + "\n\n"))
	if r.flusher != nil {
		r.flusher.Flush()
	}
}

// redact applies the configured action to text. Mask / Redact /
// Tokenize / Allow all valid; Block in a stream context degrades
// to Redact (we cannot rewind and 422 a partially-streamed
// response).
func (r *StreamRedactor) redact(text string) string {
	if r.detector == nil || r.action == ActionAllow {
		return text
	}
	action := r.action
	if action == ActionBlock {
		action = ActionRedact // can't 422 mid-stream
	}
	out, _, _ := r.detector.ApplyWith(text, action, r.extra)
	return out
}

// extractDataLine pulls the `data: {...}` payload out of a
// multi-line SSE event. Returns empty string when no data line is
// present.
func extractDataLine(event string) string {
	for _, line := range strings.Split(event, "\n") {
		if strings.HasPrefix(line, "data: ") {
			return strings.TrimPrefix(line, "data: ")
		}
		if strings.HasPrefix(line, "data:") {
			return strings.TrimPrefix(line, "data:")
		}
	}
	return ""
}
