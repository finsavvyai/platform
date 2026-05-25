// Behavior tests for the Claude Team B4 tenant-custom regex pack.
// Each test stands up the DLP middleware with a fake PolicyLookup
// that implements CustomPatternsLookup, sends a request with a
// custom-shape secret, and asserts the redact placeholder fires.
package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeCustomPatternsPolicy implements both PolicyLookup and
// CustomPatternsLookup for tests. action is what DLPAction returns;
// patterns is what CustomPatterns returns.
type fakeCustomPatternsPolicy struct {
	action   Action
	patterns []CustomPatternSpec
}

func (f fakeCustomPatternsPolicy) DLPAction(_ context.Context, _ string) (Action, error) {
	return f.action, nil
}

func (f fakeCustomPatternsPolicy) CustomPatterns(_ context.Context, _ string) ([]CustomPatternSpec, error) {
	return f.patterns, nil
}

func TestCustomPatterns_TenantPatternMatchesAndRedacts(t *testing.T) {
	policy := fakeCustomPatternsPolicy{
		action: ActionRedact,
		patterns: []CustomPatternSpec{
			{Name: "employee_id", Regex: `EMP-\d{6}`},
		},
	}
	dlp := NewDLP(NewDetector(), policy, nil)
	dlp.TenantFromCtx = func(_ context.Context) string {
		return "11111111-1111-4111-8111-111111111111"
	}

	downstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ticket from EMP-123456 about access"))
	})
	chained := dlp.Outbound()(downstream)

	rec := httptest.NewRecorder()
	chained.ServeHTTP(rec, withTenant(httptest.NewRequest(http.MethodGet, "/", nil), "t1"))

	out := rec.Body.String()
	if strings.Contains(out, "EMP-123456") {
		t.Fatalf("tenant employee_id should be redacted; got %q", out)
	}
	if !strings.Contains(out, "<EMPLOYEE_ID>") {
		t.Errorf("expected <EMPLOYEE_ID> placeholder; got %q", out)
	}
}

func TestCustomPatterns_BuiltInPackStillFiresAlongsideCustom(t *testing.T) {
	policy := fakeCustomPatternsPolicy{
		action: ActionRedact,
		patterns: []CustomPatternSpec{
			{Name: "project_code", Regex: `PRJ-[A-Z]{3}-\d{4}`},
		},
	}
	dlp := NewDLP(NewDetector(), policy, nil)
	dlp.TenantFromCtx = func(_ context.Context) string { return "t1" }

	downstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("alice@example.com on PRJ-FOO-1234"))
	})
	chained := dlp.Outbound()(downstream)

	rec := httptest.NewRecorder()
	chained.ServeHTTP(rec, withTenant(httptest.NewRequest(http.MethodGet, "/", nil), "t1"))

	out := rec.Body.String()
	if strings.Contains(out, "alice@example.com") {
		t.Errorf("built-in email pattern must still fire alongside custom; got %q", out)
	}
	if strings.Contains(out, "PRJ-FOO-1234") {
		t.Errorf("custom project_code pattern must fire; got %q", out)
	}
	for _, want := range []string{"<EMAIL>", "<PROJECT_CODE>"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in %q", want, out)
		}
	}
}

func TestCompileCustomPatterns_SkipsInvalidRegex(t *testing.T) {
	specs := []CustomPatternSpec{
		{Name: "good", Regex: `\d+`},
		{Name: "bad", Regex: `(unbalanced`}, // invalid
		{Name: "also_good", Regex: `[A-Z]+`},
	}
	patterns := CompileCustomPatterns(specs)
	if len(patterns) != 2 {
		t.Fatalf("expected 2 patterns (invalid skipped), got %d", len(patterns))
	}
	if patterns[0].name != "good" || patterns[1].name != "also_good" {
		t.Errorf("unexpected order or names: %v", patterns)
	}
}

// TestCustomPatterns_TokenizeRoundTripWithTenantPattern proves the
// custom pattern survives the tokenize round-trip: the LLM sees a
// placeholder, the customer sees the original employee id back.
func TestCustomPatterns_TokenizeRoundTripWithTenantPattern(t *testing.T) {
	policy := fakeCustomPatternsPolicy{
		action: ActionTokenize,
		patterns: []CustomPatternSpec{
			{Name: "employee_id", Regex: `EMP-\d{6}`},
		},
	}
	dlp := NewDLP(NewDetector(), policy, nil)
	dlp.TenantFromCtx = func(_ context.Context) string { return "t1" }

	originalBody := `{"prompt":"What does EMP-123456 work on?"}`
	echo := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, r.ContentLength)
		_, _ = r.Body.Read(buf)
		// Assert the LLM (downstream) saw a placeholder, not raw id.
		if strings.Contains(string(buf), "EMP-123456") {
			t.Errorf("downstream saw raw custom id: %q", buf)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(buf)
	})

	chained := dlp.Inbound()(dlp.Outbound()(echo))

	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(originalBody))
	req.ContentLength = int64(len(originalBody))
	rec := httptest.NewRecorder()
	chained.ServeHTTP(rec, withTenant(req, "t1"))

	if rec.Body.String() != originalBody {
		t.Errorf("round-trip lost data:\n  want: %q\n   got: %q",
			originalBody, rec.Body.String())
	}
}
