// Behavior tests for the Claude Team A2 SSE inline-DLP redactor.
// Each test pipes a hand-rolled Anthropic SSE stream through a
// StreamRedactor with a known action, inspects the downstream
// bytes, and asserts that PII was scrubbed (or that surrounding
// events passed through verbatim) per the contract.
package middleware

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// dripWrite splits `payload` into fragments of size `chunk` and
// writes each fragment separately. Mimics how the upstream Anthropic
// stream arrives at the redactor — a few bytes at a time.
func dripWrite(t *testing.T, w *StreamRedactor, payload string, chunk int) {
	t.Helper()
	for i := 0; i < len(payload); i += chunk {
		end := i + chunk
		if end > len(payload) {
			end = len(payload)
		}
		if _, err := w.Write([]byte(payload[i:end])); err != nil {
			t.Fatalf("Write fragment: %v", err)
		}
	}
}

func TestStreamRedactor_RedactsTextDelta(t *testing.T) {
	rec := httptest.NewRecorder()
	r := NewStreamRedactor(rec, NewDetector(), ActionRedact, nil)

	// Single content_block_delta carrying an email address. The
	// delta is shorter than safetyMargin so nothing emits until
	// Close() flushes the buffer.
	stream := "event: content_block_delta\n" +
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi alice@example.com bye"}}` +
		"\n\n"
	dripWrite(t, r, stream, 8)
	_ = r.Close()

	out := rec.Body.String()
	if strings.Contains(out, "alice@example.com") {
		t.Errorf("inline DLP missed PII in stream: %q", out)
	}
	if !strings.Contains(out, "<EMAIL>") {
		t.Errorf("expected <EMAIL> placeholder; got %q", out)
	}
}

func TestStreamRedactor_PassesNonTextEventsVerbatim(t *testing.T) {
	rec := httptest.NewRecorder()
	r := NewStreamRedactor(rec, NewDetector(), ActionRedact, nil)

	// message_start has no redactable content; must reach the
	// downstream byte-for-byte.
	in := "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_01\"}}\n\n"
	_, _ = r.Write([]byte(in))
	_ = r.Close()

	if !strings.Contains(rec.Body.String(), `"id":"msg_01"`) {
		t.Errorf("non-text event lost: %q", rec.Body.String())
	}
}

func TestStreamRedactor_CatchesPIISpanningEventBoundary(t *testing.T) {
	rec := httptest.NewRecorder()
	r := NewStreamRedactor(rec, NewDetector(), ActionRedact, nil)

	// Two adjacent text_delta events: first carries "hi alice@",
	// second carries "example.com bye". Without the safety margin,
	// neither half matches the email regex on its own and the
	// stream would leak. With it, the redactor holds the trailing
	// chars until the next event arrives.
	stream := strings.Repeat("a", 200) + "alice@" // 206 chars to push past safetyMargin
	first := "event: content_block_delta\ndata: " +
		`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"` + stream + `"}}` + "\n\n"
	second := "event: content_block_delta\ndata: " +
		`{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"example.com bye"}}` + "\n\n"
	_, _ = r.Write([]byte(first))
	_, _ = r.Write([]byte(second))
	_ = r.Close()

	out := rec.Body.String()
	if strings.Contains(out, "alice@example.com") {
		t.Errorf("PII split across events leaked: %q", out)
	}
	if !strings.Contains(out, "<EMAIL>") {
		t.Errorf("expected <EMAIL> placeholder after boundary span; got %q", out)
	}
}

func TestStreamRedactor_AllowActionPassesThrough(t *testing.T) {
	rec := httptest.NewRecorder()
	r := NewStreamRedactor(rec, NewDetector(), ActionAllow, nil)

	in := "event: content_block_delta\n" +
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"alice@example.com"}}` +
		"\n\n"
	_, _ = r.Write([]byte(in))
	_ = r.Close()

	if !strings.Contains(rec.Body.String(), "alice@example.com") {
		t.Errorf("Allow action should pass PII through; got %q", rec.Body.String())
	}
}

func TestStreamRedactor_BlockDegradesToRedactInStream(t *testing.T) {
	// Block in a streaming context cannot 422 mid-response, so the
	// redactor degrades to Redact. Customer sees placeholders
	// instead of a half-stream that suddenly errors.
	rec := httptest.NewRecorder()
	r := NewStreamRedactor(rec, NewDetector(), ActionBlock, nil)

	in := "event: content_block_delta\n" +
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"alice@example.com"}}` +
		"\n\n"
	_, _ = r.Write([]byte(in))
	_ = r.Close()

	out := rec.Body.String()
	if strings.Contains(out, "alice@example.com") {
		t.Errorf("Block should still scrub PII; got %q", out)
	}
	if !strings.Contains(out, "<EMAIL>") {
		t.Errorf("expected redact placeholder under block-degrade; got %q", out)
	}
}

func TestStreamRedactor_HonorsCustomPatterns(t *testing.T) {
	rec := httptest.NewRecorder()
	patterns := CompileCustomPatterns([]CustomPatternSpec{
		{Name: "employee_id", Regex: `EMP-\d{6}`},
	})
	r := NewStreamRedactor(rec, NewDetector(), ActionRedact, patterns)

	in := "event: content_block_delta\n" +
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ticket from EMP-123456"}}` +
		"\n\n"
	_, _ = r.Write([]byte(in))
	_ = r.Close()

	out := rec.Body.String()
	if strings.Contains(out, "EMP-123456") {
		t.Errorf("custom pattern missed in stream: %q", out)
	}
	if !strings.Contains(out, "<EMPLOYEE_ID>") {
		t.Errorf("expected <EMPLOYEE_ID> placeholder; got %q", out)
	}
}

func TestStreamRedactor_FlushesBufferOnClose(t *testing.T) {
	// A short text_delta (< safetyMargin) is held in the per-block
	// buffer. Close() must flush it through the redactor before
	// the test inspection.
	rec := httptest.NewRecorder()
	r := NewStreamRedactor(rec, NewDetector(), ActionRedact, nil)

	in := "event: content_block_delta\n" +
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"contact alice@example.com"}}` +
		"\n\n"
	_, _ = r.Write([]byte(in))
	if got := rec.Body.String(); strings.Contains(got, "alice@example.com") {
		t.Errorf("buffer should NOT have flushed yet; got %q", got)
	}
	_ = r.Close()
	if got := rec.Body.String(); strings.Contains(got, "alice@example.com") {
		t.Errorf("Close() did not flush through redactor: %q", got)
	}
}
