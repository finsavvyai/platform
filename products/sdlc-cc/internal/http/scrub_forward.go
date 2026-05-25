package http

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/finsavvyai/sdlc-core/dlp"
)

// ScrubAndForward is the transparent-proxy path for POST /v1/messages
// when the customer's traffic arrives via DNS hijack (Cowork, SDK,
// Claude Code, etc.). It runs DLP scrub on the full request body —
// catching tool_use input args, system prompts, message content,
// regardless of structure — then forwards the scrubbed request to
// real api.anthropic.com using the customer's own Authorization
// header (we never see or store their API key).
//
// Difference from HandleMessages:
//   - HandleMessages routes through OUR provider chain (sdlc-core/ai)
//     and uses our API key. Direct customers, simple flat shape.
//   - ScrubAndForward keeps the customer's existing key + adds DLP
//     transparently. Cowork-style traffic that we don't author.
//
// Response is also DLP-scrubbed in case the upstream echo'd PII back
// in tool_result content or text blocks.
func ScrubAndForward(client *http.Client, w http.ResponseWriter, r *http.Request) {
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "read body: "+err.Error(),
			http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	scrubbed, err := scrubRequestBody(rawBody)
	if err != nil {
		// Couldn't parse JSON — forward raw and let upstream decide.
		// Better than 4xx'ing on a request shape we don't understand.
		scrubbed = rawBody
	}

	upstreamURL := "https://api.anthropic.com" + r.URL.RequestURI()
	out, err := http.NewRequestWithContext(r.Context(),
		r.Method, upstreamURL, bytes.NewReader(scrubbed))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	for k, vs := range r.Header {
		if isHopByHop(k) || k == "Content-Length" {
			continue
		}
		for _, v := range vs {
			out.Header.Add(k, v)
		}
	}
	out.ContentLength = int64(len(scrubbed))

	resp, err := client.Do(out)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	scrubbedResp := scrubResponseBody(respBody)
	for k, vs := range resp.Header {
		if isHopByHop(k) || k == "Content-Length" {
			continue
		}
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.Header().Set("Content-Length",
		intToString(len(scrubbedResp)))
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(scrubbedResp)
}

// scrubRequestBody parses + scrubs + re-marshals the Anthropic
// Messages API request payload. Returns the original bytes if the
// payload doesn't parse so we don't choke on shapes we haven't
// audited.
func scrubRequestBody(b []byte) ([]byte, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(b, &payload); err != nil {
		return b, err
	}
	ScrubMessagesPayload(payload)
	return json.Marshal(payload)
}

// scrubResponseBody runs DLP on the response body's content blocks.
// Anthropic responses can contain text blocks AND tool_use blocks
// (when the assistant calls a tool); both need scrubbing. If the
// body isn't valid JSON we return it unchanged — a streaming
// response or text/event-stream is handled elsewhere.
func scrubResponseBody(b []byte) []byte {
	var payload map[string]interface{}
	if err := json.Unmarshal(b, &payload); err != nil {
		return b
	}
	if content, ok := payload["content"].([]interface{}); ok {
		payload["content"] = ScrubJSON(content)
	}
	// Apply the AML scrub to any flat top-level "text" field too,
	// covering older Anthropic response shapes.
	if t, ok := payload["text"].(string); ok {
		payload["text"] = dlp.MaskAML(t)
	}
	out, err := json.Marshal(payload)
	if err != nil {
		return b
	}
	return out
}

// intToString — small helper to avoid pulling strconv just for one
// Content-Length. Inline because the call site is one place.
func intToString(n int) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	if n < 0 {
		digits = append(digits, '-')
		n = -n
	}
	tmp := []byte{}
	for n > 0 {
		tmp = append([]byte{byte('0' + n%10)}, tmp...)
		n /= 10
	}
	return string(append(digits, tmp...))
}
