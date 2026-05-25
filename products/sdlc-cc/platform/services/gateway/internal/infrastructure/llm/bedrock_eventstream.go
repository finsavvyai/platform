// Package llm — Bedrock event-stream payload extractor.
//
// SCAFFOLD(eventstream-framing): Full application/vnd.amazon.eventstream
// framing (12-byte prelude, header BLOB, message body, CRC-32 trailer)
// is intentionally NOT reimplemented. Bedrock's Anthropic responses
// concatenate JSON payloads in the body; this minimal scanner extracts
// balanced top-level JSON objects which is enough for the
// content_block_delta + message_stop events we consume. If we ever need
// system events (throttling, internal exceptions wrapped in headers),
// upgrade to a real binary frame parser at that point.
package llm

import (
	"encoding/json"
	"io"
)

// consumeBedrockEventStream walks the response body and emits any JSON
// objects whose `delta.text` is non-empty, then a final Done.
func consumeBedrockEventStream(body io.ReadCloser, out chan<- StreamChunk) {
	defer close(out)
	defer body.Close()
	raw, err := io.ReadAll(body)
	if err != nil {
		out <- StreamChunk{Err: err}
		return
	}
	for _, payload := range extractJSONObjects(raw) {
		var ev struct {
			Type  string `json:"type"`
			Delta struct {
				Text string `json:"text"`
			} `json:"delta"`
		}
		if err := json.Unmarshal(payload, &ev); err != nil {
			continue
		}
		if ev.Delta.Text != "" {
			out <- StreamChunk{Delta: ev.Delta.Text}
		}
		if ev.Type == "message_stop" {
			out <- StreamChunk{Done: true}
			return
		}
	}
	out <- StreamChunk{Done: true}
}

// extractJSONObjects scans raw bytes for top-level {...} balanced spans.
// Skips characters inside strings so a brace inside a quoted value does
// not corrupt the depth counter.
func extractJSONObjects(raw []byte) [][]byte {
	var out [][]byte
	depth, start := 0, -1
	inString, escape := false, false
	for i := 0; i < len(raw); i++ {
		c := raw[i]
		if inString {
			if escape {
				escape = false
				continue
			}
			if c == '\\' {
				escape = true
				continue
			}
			if c == '"' {
				inString = false
			}
			continue
		}
		switch c {
		case '"':
			inString = true
		case '{':
			if depth == 0 {
				start = i
			}
			depth++
		case '}':
			depth--
			if depth == 0 && start >= 0 {
				out = append(out, raw[start:i+1])
				start = -1
			}
		}
	}
	return out
}
