package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/sdlc-core/audit"
	"github.com/finsavvyai/sdlc-core/quota"
)

// quotaEnforcerWithCap is a small helper: spin up a fresh enforcer
// with one cap dimension. AIQuotaEnforcer's constructor reads env, so
// we use t.Setenv to drive it deterministically per test.
func quotaEnforcerWithCap(t *testing.T, tenantCap int) *quota.AIQuotaEnforcer {
	t.Helper()
	t.Setenv("AEGIS_AI_DAILY_CAP", "")
	t.Setenv("AEGIS_AI_DAILY_CAP_PER_SEAT", "")
	if tenantCap > 0 {
		t.Setenv("AEGIS_AI_DAILY_CAP", itoa10(tenantCap))
	}
	return quota.NewAIQuotaEnforcer()
}

func itoa10(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+(n%10))) + s
		n /= 10
	}
	return s
}

func messagesRequest(content string) []byte {
	b, _ := json.Marshal(MessagesRequest{
		Model: "claude-haiku-4-5", MaxTokens: 64,
		Messages: []Message{{Role: "user", Content: content}},
	})
	return b
}

func TestHandleMessages_QuotaUnderCap_Allows(t *testing.T) {
	repo := audit.NewInMemoryRepository()
	enf := quotaEnforcerWithCap(t, 5)
	if enf == nil {
		t.Fatal("expected enforcer")
	}
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(messagesRequest("hi")))
	req = req.WithContext(context.WithValue(req.Context(), tenantCtxKey{}, "tnt_a"))
	rec := httptest.NewRecorder()
	HandleMessages(fakeProvider{configured: true, out: "ok"}, repo, enf, nil)(rec, req)
	if rec.Code != 200 {
		t.Fatalf("under cap should pass: got %d", rec.Code)
	}
}

func TestHandleMessages_QuotaOverCap_Denies429(t *testing.T) {
	repo := audit.NewInMemoryRepository()
	enf := quotaEnforcerWithCap(t, 2)

	// Burn the cap with two successful calls.
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(messagesRequest("ping")))
		req = req.WithContext(context.WithValue(req.Context(), tenantCtxKey{}, "tnt_burn"))
		rec := httptest.NewRecorder()
		HandleMessages(fakeProvider{configured: true, out: "pong"}, repo, enf, nil)(rec, req)
		if rec.Code != 200 {
			t.Fatalf("call %d should pass while under cap, got %d", i, rec.Code)
		}
	}

	// Third call must be rejected with 429 + an audit row classified
	// as QUOTA_EXCEEDED so operators can see why it bounced.
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(messagesRequest("over")))
	req = req.WithContext(context.WithValue(req.Context(), tenantCtxKey{}, "tnt_burn"))
	rec := httptest.NewRecorder()
	HandleMessages(fakeProvider{configured: true, out: "should-not-run"}, repo, enf, nil)(rec, req)
	if rec.Code != 429 {
		t.Fatalf("over cap should be 429, got %d body=%s", rec.Code, rec.Body.String())
	}

	// Audit row must carry the explicit QUOTA_EXCEEDED code so the
	// dashboard surfaces "tripped quota" not "unknown error".
	var foundQuota bool
	for _, r := range repoAll(t, repo) {
		if r.ErrorCode == "QUOTA_EXCEEDED" {
			foundQuota = true
			break
		}
	}
	if !foundQuota {
		t.Errorf("expected QUOTA_EXCEEDED audit row, got none")
	}
}

func TestHandleMessages_FailedCallDoesNotBurnQuota(t *testing.T) {
	repo := audit.NewInMemoryRepository()
	enf := quotaEnforcerWithCap(t, 2)

	// Two failed calls — quota counter should NOT advance because
	// Record() runs only after success.
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(messagesRequest("x")))
		req = req.WithContext(context.WithValue(req.Context(), tenantCtxKey{}, "tnt_err"))
		rec := httptest.NewRecorder()
		HandleMessages(erroringProvider{}, repo, enf, nil)(rec, req)
		if rec.Code != 502 {
			t.Fatalf("provider error should be 502, got %d", rec.Code)
		}
	}

	// Third call (a success) must still be allowed.
	req := httptest.NewRequest("POST", "/v1/messages", bytes.NewReader(messagesRequest("ok")))
	req = req.WithContext(context.WithValue(req.Context(), tenantCtxKey{}, "tnt_err"))
	rec := httptest.NewRecorder()
	HandleMessages(fakeProvider{configured: true, out: "ok"}, repo, enf, nil)(rec, req)
	if rec.Code != 200 {
		t.Errorf("failed calls should not burn quota; got %d", rec.Code)
	}
}

// repoAll pulls every row regardless of window/tenant — useful for
// tests that just want to assert "this row landed in the repo at
// all" without computing time arithmetic.
func repoAll(t *testing.T, repo *audit.InMemoryRepository) []audit.AIRequestLog {
	t.Helper()
	rows, _ := repo.ListByTenant(context.Background(), "",
		// Far past, far future — covers every row created in the test.
		zeroTime(), farFuture(), 1000)
	return rows
}
