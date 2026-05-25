// Behavior tests for the Claude Team B2 reversible-tokenization
// pipeline. The Detector primitives (Tokenize / Detokenize) are
// covered first; then a full middleware round-trip proves the
// inbound leg replaces values and the outbound leg restores them
// using the context-attached map.
package middleware

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDetector_Tokenize_PreservesViaDetokenize(t *testing.T) {
	d := NewDetector()
	in := "Email me at alice@example.com or bob@example.org. SSN 123-45-6789."
	out, m, matches := d.Tokenize(in)

	if len(matches) == 0 {
		t.Fatal("expected at least one match")
	}
	if out == in {
		t.Fatal("Tokenize did not rewrite the input")
	}
	if !strings.Contains(out, "<EMAIL_001>") || !strings.Contains(out, "<EMAIL_002>") {
		t.Errorf("expected EMAIL_001 + EMAIL_002 in %q", out)
	}
	if !strings.Contains(out, "<SSN_001>") {
		t.Errorf("expected SSN_001 in %q", out)
	}

	restored := Detokenize(out, m)
	if restored != in {
		t.Errorf("round-trip lost data:\n  in: %q\n out: %q", in, restored)
	}
}

func TestDetector_Tokenize_DuplicatesCollapse(t *testing.T) {
	d := NewDetector()
	in := "alice@example.com replied. alice@example.com replied again."
	out, m, _ := d.Tokenize(in)

	count := strings.Count(out, "<EMAIL_001>")
	if count != 2 {
		t.Errorf("expected the same EMAIL_001 token twice, got %d occurrences in %q", count, out)
	}
	if strings.Contains(out, "<EMAIL_002>") {
		t.Errorf("duplicate value should not get a second token; got %q", out)
	}
	if got := m["<EMAIL_001>"]; got != "alice@example.com" {
		t.Errorf("token map mismatch: got %q, want alice@example.com", got)
	}
}

func TestDetector_Tokenize_EmptyInputIsNoop(t *testing.T) {
	d := NewDetector()
	out, m, matches := d.Tokenize("hello world, no PII here")
	if out != "hello world, no PII here" {
		t.Errorf("non-PII input should pass through unchanged; got %q", out)
	}
	if len(m) != 0 {
		t.Errorf("expected empty map; got %v", m)
	}
	if len(matches) != 0 {
		t.Errorf("expected zero matches; got %d", len(matches))
	}
}

// fakePolicyAlwaysTokenize is a PolicyLookup that always returns
// ActionTokenize so the round-trip middleware test doesn't need a
// Postgres fixture.
type fakePolicyAlwaysTokenize struct{}

func (fakePolicyAlwaysTokenize) DLPAction(_ context.Context, _ string) (Action, error) {
	return ActionTokenize, nil
}

// TestDLP_TokenizeRoundtripThroughMiddleware proves the chained
// behavior: inbound leg replaces PII with placeholders, the
// downstream handler echoes the (tokenized) body, and outbound leg
// restores the originals using the context-attached map. The
// caller-visible output is the original input.
func TestDLP_TokenizeRoundtripThroughMiddleware(t *testing.T) {
	dlp := NewDLP(NewDetector(), fakePolicyAlwaysTokenize{}, nil)
	dlp.TenantFromCtx = func(_ context.Context) string {
		return "11111111-1111-4111-8111-111111111111"
	}

	// Echo handler: reads the (tokenized) body and writes it back.
	echo := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	})

	// Compose to match the real chain order: Inbound is registered
	// first in chain.go (step 8a) so chi makes it the OUTER
	// middleware; Outbound is registered later (step 12a) and lives
	// closer to the handler. Wrap handler-first so the resulting
	// flow is: Inbound → ... → Outbound → handler. That ordering is
	// what lets Outbound's post-next code read the TokenMap that
	// Inbound attached to the request context.
	chained := dlp.Inbound()(dlp.Outbound()(echo))

	originalPrompt := `{"prompt":"Send report to alice@example.com (SSN 123-45-6789)"}`
	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages",
		strings.NewReader(originalPrompt))
	req.ContentLength = int64(len(originalPrompt))

	rec := httptest.NewRecorder()
	chained.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%q", rec.Code, rec.Body.String())
	}

	if got := rec.Body.String(); got != originalPrompt {
		t.Errorf("round-trip lost data:\n  want: %q\n   got: %q", originalPrompt, got)
	}
}

// TestDLP_TokenizeMiddleware_LLMSeesPlaceholdersOnly proves the
// security property: the downstream handler (acting as a stand-in
// for the upstream LLM) must NEVER receive raw PII when the policy
// is tokenize. We capture the body the handler receives and assert
// it contains placeholders, not the original values.
func TestDLP_TokenizeMiddleware_LLMSeesPlaceholdersOnly(t *testing.T) {
	dlp := NewDLP(NewDetector(), fakePolicyAlwaysTokenize{}, nil)
	dlp.TenantFromCtx = func(_ context.Context) string {
		return "22222222-2222-4222-8222-222222222222"
	}

	var capturedDownstreamBody []byte
	downstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedDownstreamBody, _ = io.ReadAll(r.Body)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	chained := dlp.Outbound()(dlp.Inbound()(downstream))

	body := bytes.NewReader([]byte(`{"prompt":"alice@example.com"}`))
	req := httptest.NewRequest(http.MethodPost, "/anthropic/v1/messages", body)
	req.ContentLength = 32
	rec := httptest.NewRecorder()
	chained.ServeHTTP(rec, req)

	got := string(capturedDownstreamBody)
	if strings.Contains(got, "alice@example.com") {
		t.Errorf("downstream/LLM saw raw PII: %q (security violation — tokenize must always replace before forwarding)", got)
	}
	if !strings.Contains(got, "<EMAIL_") {
		t.Errorf("downstream body should contain a placeholder; got %q", got)
	}
}
