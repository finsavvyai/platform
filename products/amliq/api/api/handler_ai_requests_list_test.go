package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/storage"
)

func seedAIRequestLog(t *testing.T, repo *storage.InMemoryAIRequestLogRepo) {
	t.Helper()
	one := 100
	two := int64(2_500_000)
	for _, r := range []storage.AIRequestLog{
		{TenantID: "tnt_abc123def456", ActorID: "usr_alice",
			Provider: "anthropic", Model: "claude-haiku",
			SummaryType: "alert", PromptTokens: &one,
			LatencyMs: 200, Status: "ok", CostUSDMicros: &two},
		{TenantID: "tnt_abc123def456", ActorID: "usr_bob",
			Provider: "bedrock", Model: "claude-haiku",
			SummaryType: "case", PromptTokens: &one,
			LatencyMs: 300, Status: "ok", CostUSDMicros: &two},
	} {
		_ = repo.Create(context.Background(), r)
	}
}

func TestHandleAIRequestsList(t *testing.T) {
	repo := storage.NewInMemoryAIRequestLogRepo()
	seedAIRequestLog(t, repo)
	tests := []struct {
		name   string
		auth   bool
		q      string
		expect int
	}{
		{"missing auth", false, "", http.StatusUnauthorized},
		{"happy default window", true, "", http.StatusOK},
		{"bad limit", true, "?limit=99999", http.StatusBadRequest},
		{"bad since", true, "?since=garbage", http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET",
				"/api/v1/ai/requests"+tt.q, nil)
			if tt.auth {
				req = req.WithContext(ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_abc123def456", UserID: "u",
						Role: "admin"}))
			}
			rec := httptest.NewRecorder()
			handleAIRequestsList(repo)(rec, req)
			if rec.Code != tt.expect {
				t.Fatalf("got %d want %d body=%s",
					rec.Code, tt.expect, rec.Body.String())
			}
		})
	}
}

func TestHandleAICost_Sum(t *testing.T) {
	repo := storage.NewInMemoryAIRequestLogRepo()
	seedAIRequestLog(t, repo)
	req := httptest.NewRequest("GET", "/api/v1/team/ai-cost", nil)
	req = req.WithContext(ContextWithClaims(context.Background(),
		&Claims{TenantID: "tnt_abc123def456", UserID: "u", Role: "admin"}))
	rec := httptest.NewRecorder()
	handleAICost(repo)(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "total_usd_cents") {
		t.Errorf("missing total_usd_cents: %s", rec.Body.String())
	}
	var raw map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &raw)
	data, _ := raw["data"].(map[string]interface{})
	cents, _ := data["total_usd_cents"].(float64)
	// 2 rows × 2_500_000 micros each = 5_000_000 micros = 500 cents
	if int64(cents) != 500 {
		t.Errorf("cost: got %v want 500 cents", cents)
	}
}

// TestRecordAIRequest_NilRepoIsNoOp asserts the fail-open contract:
// observability MUST NOT break the handler if the repo is nil.
func TestRecordAIRequest_NilRepoIsNoOp(t *testing.T) {
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("recordAIRequest panicked on nil repo: %v", r)
		}
	}()
	row := buildSuccessLog("tnt_x", "usr_y", "anthropic", "claude-haiku",
		"alert", "p", "r", time.Millisecond, false)
	recordAIRequest(nil, row)
}
