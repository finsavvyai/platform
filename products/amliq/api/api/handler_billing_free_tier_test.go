package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aegis-aml/aegis/internal/billing"
	"github.com/aegis-aml/aegis/internal/domain"
)

// TestFreeTierUsageReportsRealCount reproduces the abuse-vector bug
// from the May 8 dashboard report: GET /api/v1/billing/usage returned
// `current: 0` while the daily cap was correctly enforcing on the
// screening endpoint. The handler must mirror what CheckFreeTier
// sees so the dashboard counter agrees with the enforcer.
func TestFreeTierUsageReportsRealCount(t *testing.T) {
	tests := []struct {
		name      string
		used      int64
		wantCount float64
	}{
		{"zero on fresh tenant", 0, 0},
		{"mid-day", 7, 7},
		{"at limit", int64(FreeTierScreeningsPerDay), float64(FreeTierScreeningsPerDay)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			usage := &memUsageRepo{}
			enforcer := billing.NewEnforcer(noSubRepo{}, usage)
			tid, _ := domain.NewTenantID("tnt_000000000001")
			if tt.used > 0 {
				_ = usage.IncrementMetric(context.Background(), tid,
					domain.ProductAPI, "ignored",
					domain.MetricAPIScreenings, tt.used)
			}
			handler := freeTierUsageHandler(enforcer)
			req := httptest.NewRequest(http.MethodGet, "/api/v1/billing/usage", nil)
			req = req.WithContext(ContextWithClaims(req.Context(),
				&Claims{TenantID: "tnt_000000000001", UserID: "u", Role: "admin"}))
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)
			if rr.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
			}
			gotCurrent := extractCurrent(t, rr.Body.Bytes())
			if gotCurrent != tt.wantCount {
				t.Errorf("current=%v, want %v", gotCurrent, tt.wantCount)
			}
		})
	}
}

func TestFreeTierUsageReturnsZeroWithoutClaims(t *testing.T) {
	handler := freeTierUsageHandler(billing.NewEnforcer(noSubRepo{}, &memUsageRepo{}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/billing/usage", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if got := extractCurrent(t, rr.Body.Bytes()); got != 0 {
		t.Errorf("current=%v, want 0 for unauthenticated request", got)
	}
}

func TestFreeTierUsageReturnsZeroWithoutEnforcer(t *testing.T) {
	handler := freeTierUsageHandler(nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/billing/usage", nil)
	req = req.WithContext(ContextWithClaims(req.Context(),
		&Claims{TenantID: "tnt_000000000001", UserID: "u", Role: "admin"}))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if got := extractCurrent(t, rr.Body.Bytes()); got != 0 {
		t.Errorf("current=%v, want 0 when enforcer absent", got)
	}
}

func extractCurrent(t *testing.T, body []byte) float64 {
	t.Helper()
	var resp struct {
		Data struct {
			Metrics []struct {
				Current float64 `json:"current"`
			} `json:"metrics"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.Data.Metrics) == 0 {
		t.Fatalf("no metrics in response: %s", body)
	}
	return resp.Data.Metrics[0].Current
}
