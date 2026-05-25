package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleBillingPlans(t *testing.T) {
	tests := []struct {
		name       string
		url        string
		wantStatus int
		wantPlans  bool
	}{
		{
			name:       "all_plans",
			url:        "/api/v1/billing/plans",
			wantStatus: http.StatusOK,
			wantPlans:  true,
		},
		{
			name:       "filter_by_product",
			url:        "/api/v1/billing/plans?product=api",
			wantStatus: http.StatusOK,
			wantPlans:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.url, nil)
			w := httptest.NewRecorder()

			handleBillingPlans(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tt.wantStatus)
			}
			if tt.wantPlans {
				var result map[string]interface{}
				json.NewDecoder(w.Body).Decode(&result)
				data, _ := result["data"].(map[string]interface{})
				if data == nil {
					t.Fatal("response missing data envelope")
				}
				if _, ok := data["plans"]; !ok {
					t.Error("response missing plans")
				}
			}
		})
	}
}
