package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func mustEntry(t *testing.T, tid domain.TenantID, actor string, ts time.Time, summaryType string) domain.AuditEntry {
	t.Helper()
	e, err := domain.NewAuditEntry(tid, domain.AuditActionAISummarized,
		actor, "ai_summary", summaryType)
	if err != nil {
		t.Fatalf("entry: %v", err)
	}
	e.Timestamp = ts
	if summaryType != "" {
		e.Details["summary_type"] = summaryType
	}
	return e
}

func TestHandleTeamAIUsage(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_abc123def456")
	now := time.Now().UTC()
	repo := storage.NewInMemoryAuditRepo()
	for _, e := range []domain.AuditEntry{
		mustEntry(t, tid, "usr_alice", now.Add(-1*time.Hour), "alert"),
		mustEntry(t, tid, "usr_alice", now.Add(-2*time.Hour), "alert"),
		mustEntry(t, tid, "usr_alice", now.Add(-3*time.Hour), "case"),
		mustEntry(t, tid, "usr_bob", now.Add(-1*time.Hour), "adverse_media"),
		mustEntry(t, tid, "usr_old", now.Add(-90*24*time.Hour), "alert"),
	} {
		_ = repo.Create(e)
	}

	tests := []struct {
		name       string
		auth       bool
		expectCode int
	}{
		{"missing auth", false, http.StatusUnauthorized},
		{"happy", true, http.StatusOK},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/team/ai-usage", nil)
			if tt.auth {
				req = req.WithContext(ContextWithClaims(context.Background(),
					&Claims{TenantID: "tnt_abc123def456", UserID: "u",
						Role: "admin"}))
			}
			rec := httptest.NewRecorder()
			handleTeamAIUsage(repo)(rec, req)
			if rec.Code != tt.expectCode {
				t.Fatalf("status %d want %d body=%s",
					rec.Code, tt.expectCode, rec.Body.String())
			}
		})
	}
}

// TestBuildAIUsageReport_Aggregation locks in the per-actor counts +
// the time-window filtering. Critical because dashboards depend on
// the count being exactly the AI calls in the window — not "all
// audit entries" (which would also include screen + login events).
func TestBuildAIUsageReport_Aggregation(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_abc123def456")
	now := time.Now().UTC()
	since := now.Add(-7 * 24 * time.Hour)
	until := now
	in := []domain.AuditEntry{
		mustEntry(t, tid, "usr_alice", now.Add(-1*time.Hour), "alert"),
		mustEntry(t, tid, "usr_alice", now.Add(-2*time.Hour), "case"),
		mustEntry(t, tid, "usr_bob", now.Add(-3*time.Hour), "adverse_media"),
		// outside window (90 days back)
		mustEntry(t, tid, "usr_old", now.Add(-90*24*time.Hour), "alert"),
	}
	r := buildAIUsageReport(in, since, until)
	if r.TotalCalls != 3 {
		t.Errorf("total: got %d want 3", r.TotalCalls)
	}
	if len(r.Members) != 2 {
		t.Errorf("members: got %d want 2", len(r.Members))
	}
	if r.Members[0].ActorID != "usr_alice" {
		t.Errorf("sort order broken: %v", r.Members)
	}
	if r.Members[0].SummaryTypes["alert"] != 1 ||
		r.Members[0].SummaryTypes["case"] != 1 {
		t.Errorf("alice types: %v", r.Members[0].SummaryTypes)
	}
}

// TestHandleTeamAIUsage_BadSince verifies the query-param parser
// returns 400 (not 500) on malformed RFC3339.
func TestHandleTeamAIUsage_BadSince(t *testing.T) {
	repo := storage.NewInMemoryAuditRepo()
	req := httptest.NewRequest("GET",
		"/api/v1/team/ai-usage?since=not-a-date", nil)
	req = req.WithContext(ContextWithClaims(context.Background(),
		&Claims{TenantID: "tnt_abc123def456", UserID: "u", Role: "admin"}))
	rec := httptest.NewRecorder()
	handleTeamAIUsage(repo)(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

// TestHandleTeamAIUsage_ResponseShape locks in the JSON keys the
// frontend will consume. Renaming any of these breaks the dashboard.
func TestHandleTeamAIUsage_ResponseShape(t *testing.T) {
	tid, _ := domain.NewTenantID("tnt_abc123def456")
	repo := storage.NewInMemoryAuditRepo()
	_ = repo.Create(mustEntry(t, tid, "usr_x",
		time.Now().Add(-1*time.Hour), "alert"))
	req := httptest.NewRequest("GET", "/api/v1/team/ai-usage", nil)
	req = req.WithContext(ContextWithClaims(context.Background(),
		&Claims{TenantID: "tnt_abc123def456", UserID: "u", Role: "admin"}))
	rec := httptest.NewRecorder()
	handleTeamAIUsage(repo)(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("body=%s", rec.Body.String())
	}
	var raw map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &raw)
	data, _ := raw["data"].(map[string]interface{})
	for _, k := range []string{"since", "until", "members", "total_calls"} {
		if _, ok := data[k]; !ok {
			t.Errorf("missing field %q", k)
		}
	}
}
