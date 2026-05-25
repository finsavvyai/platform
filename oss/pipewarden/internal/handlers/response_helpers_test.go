package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

// ---------------------------------------------------------------------------
// csvEscape
// ---------------------------------------------------------------------------

func TestCsvEscape_NeedsNoQuoting(t *testing.T) {
	assert.Equal(t, "hello", csvEscape("hello"))
	assert.Equal(t, "simple value", csvEscape("simple value"))
}

func TestCsvEscape_ContainsComma(t *testing.T) {
	assert.Equal(t, `"a,b"`, csvEscape("a,b"))
}

func TestCsvEscape_ContainsNewline(t *testing.T) {
	assert.Equal(t, "\"line1\nline2\"", csvEscape("line1\nline2"))
}

func TestCsvEscape_ContainsCarriageReturn(t *testing.T) {
	assert.Equal(t, "\"line1\rline2\"", csvEscape("line1\rline2"))
}

func TestCsvEscape_ContainsDoubleQuote(t *testing.T) {
	// Double quotes inside the value should be doubled.
	assert.Equal(t, `"say ""hello"""`, csvEscape(`say "hello"`))
}

func TestCsvEscape_EmptyString(t *testing.T) {
	assert.Equal(t, "", csvEscape(""))
}

// ---------------------------------------------------------------------------
// itoa (internal helper)
// ---------------------------------------------------------------------------

func TestItoa_Zero(t *testing.T) {
	assert.Equal(t, "0", itoa(0))
}

func TestItoa_Positive(t *testing.T) {
	assert.Equal(t, "42", itoa(42))
	assert.Equal(t, "1000000", itoa(1_000_000))
}

func TestItoa_Negative(t *testing.T) {
	assert.Equal(t, "-7", itoa(-7))
}

// ---------------------------------------------------------------------------
// auditActor
// ---------------------------------------------------------------------------

func TestAuditActor_FromUserHeader(t *testing.T) {
	req := newAuditTestRequest("X-PipeWarden-User", "alice@example.com")
	assert.Equal(t, "alice@example.com", auditActor(req))
}

func TestAuditActor_FromRequestID(t *testing.T) {
	req := newAuditTestRequest("X-Request-ID", "req-xyz")
	assert.Equal(t, "anon:req-xyz", auditActor(req))
}

func TestAuditActor_Anonymous(t *testing.T) {
	req := newAuditTestRequest("", "")
	assert.Equal(t, "anon", auditActor(req))
}

// ---------------------------------------------------------------------------
// helpers — thin request factories
// ---------------------------------------------------------------------------

func newAuditTestRequest(key, value string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if key != "" {
		req.Header.Set(key, value)
	}
	return req
}

// ---------------------------------------------------------------------------
// healthStatus
// ---------------------------------------------------------------------------

func TestHealthStatus_Connected(t *testing.T) {
	assert.Equal(t, "connected", healthStatus(true))
}

func TestHealthStatus_Error(t *testing.T) {
	assert.Equal(t, "error", healthStatus(false))
}

// ---------------------------------------------------------------------------
// validCronExpr
// ---------------------------------------------------------------------------

func TestValidCronExpr_Valid(t *testing.T) {
	assert.True(t, validCronExpr("0 */6 * * *"))
	assert.True(t, validCronExpr("5 4 * * 0"))
	assert.True(t, validCronExpr("* * * * *"))
}

func TestValidCronExpr_Invalid(t *testing.T) {
	assert.False(t, validCronExpr(""))
	assert.False(t, validCronExpr("not a cron"))
	assert.False(t, validCronExpr("1 2 3 4"))     // only 4 fields
	assert.False(t, validCronExpr("1 2 3 4 5 6")) // 6 fields
}

// ---------------------------------------------------------------------------
// extractConnectionName
// ---------------------------------------------------------------------------

func TestExtractConnectionName_Schedule(t *testing.T) {
	name := extractConnectionName("/api/v1/connections/myconn/schedule", "/schedule")
	assert.Equal(t, "myconn", name)
}

func TestExtractConnectionName_MissingPrefix(t *testing.T) {
	name := extractConnectionName("/some/other/path/myconn/schedule", "/schedule")
	assert.Equal(t, "", name)
}

func TestExtractConnectionName_NoTrailingSlash(t *testing.T) {
	// Without trailing slash the function should work correctly.
	name := extractConnectionName("/api/v1/connections/my-conn/schedule", "/schedule")
	assert.Equal(t, "my-conn", name)
}

func TestExtractConnectionName_EmptyName(t *testing.T) {
	// Suffix immediately after the base with nothing in between.
	name := extractConnectionName("/api/v1/connections//schedule", "/schedule")
	assert.Equal(t, "", name)
}

// ---------------------------------------------------------------------------
// inferAuthMethod
// ---------------------------------------------------------------------------

func TestInferAuthMethod_UsesExisting(t *testing.T) {
	assert.Equal(t, "github_app", inferAuthMethod("github_app", "tok", "user", "pass"))
}

func TestInferAuthMethod_BasicWhenUserPresent(t *testing.T) {
	assert.Equal(t, "basic", inferAuthMethod("", "", "user", ""))
}

func TestInferAuthMethod_BasicWhenAppPasswordPresent(t *testing.T) {
	assert.Equal(t, "basic", inferAuthMethod("", "", "", "pass"))
}

func TestInferAuthMethod_TokenWhenTokenPresent(t *testing.T) {
	assert.Equal(t, "token", inferAuthMethod("", "tok", "", ""))
}

func TestInferAuthMethod_DefaultToken(t *testing.T) {
	assert.Equal(t, "token", inferAuthMethod("", "", "", ""))
}

// ---------------------------------------------------------------------------
// extractConnNameFromRuntimePath
// ---------------------------------------------------------------------------

func TestExtractConnNameFromRuntimePath_Happy(t *testing.T) {
	name := extractConnNameFromRuntimePath("/api/v1/connections/myconn/scan/runtime")
	assert.Equal(t, "myconn", name)
}

func TestExtractConnNameFromRuntimePath_WithDash(t *testing.T) {
	name := extractConnNameFromRuntimePath("/api/v1/connections/my-cool-conn/scan/runtime")
	assert.Equal(t, "my-cool-conn", name)
}
