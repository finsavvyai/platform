package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/sdlc-core/audit"
)

func seedRepo(t *testing.T) audit.Repository {
	t.Helper()
	repo := audit.NewInMemoryRepository()
	cost1 := int64(2_500_000) // $2.50
	cost2 := int64(1_000_000)
	rows := []audit.AIRequestLog{
		{TenantID: "tnt_a", Provider: "anthropic", Status: "ok", CostUSDMicros: &cost1},
		{TenantID: "tnt_a", Provider: "anthropic", Status: "ok", CostUSDMicros: &cost2},
		{TenantID: "tnt_a", Provider: "bedrock", Status: "blocked"},
		{TenantID: "tnt_b", Provider: "anthropic", Status: "ok", CostUSDMicros: &cost1},
	}
	for _, r := range rows {
		_ = repo.Create(context.Background(), r)
	}
	return repo
}

func TestAuditUsage_Unauthorized_NoToken(t *testing.T) {
	t.Setenv("SDLC_ADMIN_BEARER", "tok-xyz")
	h := AuditUsageHandler(seedRepo(t))
	req := httptest.NewRequest("GET", "/v1/audit/usage", nil)
	w := httptest.NewRecorder()
	h(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", w.Code)
	}
}

func TestAuditUsage_Unauthorized_NoEnvSet(t *testing.T) {
	t.Setenv("SDLC_ADMIN_BEARER", "")
	h := AuditUsageHandler(seedRepo(t))
	req := httptest.NewRequest("GET", "/v1/audit/usage", nil)
	req.Header.Set("Authorization", "Bearer anything")
	w := httptest.NewRecorder()
	h(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("missing env should refuse: got %d", w.Code)
	}
}

func TestAuditUsage_AggregatesAcrossTenants(t *testing.T) {
	t.Setenv("SDLC_ADMIN_BEARER", "tok-xyz")
	h := AuditUsageHandler(seedRepo(t))

	req := httptest.NewRequest("GET", "/v1/audit/usage", nil)
	req.Header.Set("Authorization", "Bearer tok-xyz")
	w := httptest.NewRecorder()
	h(w, req)

	if w.Code != 200 {
		t.Fatalf("want 200, got %d: %s", w.Code, w.Body.String())
	}
	var body map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if int(body["total_requests"].(float64)) != 4 {
		t.Errorf("total_requests = %v", body["total_requests"])
	}
	// 2.5M + 1M + 2.5M = 6M micros across all tenants
	if int64(body["total_cost_usd_micros"].(float64)) != 6_000_000 {
		t.Errorf("total_cost = %v", body["total_cost_usd_micros"])
	}
	prov := body["by_provider"].([]interface{})
	if len(prov) != 2 {
		t.Errorf("expected 2 providers, got %d", len(prov))
	}
}

func TestAuditUsage_FilterByTenant(t *testing.T) {
	t.Setenv("SDLC_ADMIN_BEARER", "tok-xyz")
	h := AuditUsageHandler(seedRepo(t))

	req := httptest.NewRequest("GET", "/v1/audit/usage?tenant_id=tnt_b", nil)
	req.Header.Set("Authorization", "Bearer tok-xyz")
	w := httptest.NewRecorder()
	h(w, req)

	var body map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if int(body["total_requests"].(float64)) != 1 {
		t.Errorf("tnt_b should have 1 request, got %v", body["total_requests"])
	}
}

func TestAuditUsage_RespectsTimeWindow(t *testing.T) {
	t.Setenv("SDLC_ADMIN_BEARER", "tok-xyz")
	repo := audit.NewInMemoryRepository()
	_ = repo.Create(context.Background(), audit.AIRequestLog{TenantID: "tnt_a", Provider: "anthropic", Status: "ok"})

	future := time.Now().Add(24 * time.Hour).Unix()
	url := "/v1/audit/usage?since=" + itoa(future) + "&until=" + itoa(future+3600)
	req := httptest.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer tok-xyz")
	w := httptest.NewRecorder()
	AuditUsageHandler(repo)(w, req)

	var body map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if int(body["total_requests"].(float64)) != 0 {
		t.Errorf("future window should be empty, got %v", body["total_requests"])
	}
}

func itoa(v int64) string {
	s := ""
	if v == 0 {
		return "0"
	}
	neg := v < 0
	if neg {
		v = -v
	}
	for v > 0 {
		s = string(rune('0'+(v%10))) + s
		v /= 10
	}
	if neg {
		s = "-" + s
	}
	return s
}
