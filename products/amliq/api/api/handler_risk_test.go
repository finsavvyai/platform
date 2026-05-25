package api

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleRiskScore(t *testing.T) {
	tests := []struct {
		name       string
		tenantID   string
		body       string
		wantStatus int
		wantLevel  string
	}{
		{
			"high risk entity",
			"tnt_abcdefghijkl",
			`{"entity_id":"e1","sanctions_score":0.9,"pep_score":0.8,"adverse_media_score":0.7,"country":"IR","industry_score":0.6}`,
			200, "critical",
		},
		{
			"low risk entity",
			"tnt_abcdefghijkl",
			`{"entity_id":"e2","sanctions_score":0.1,"pep_score":0.0,"adverse_media_score":0.0,"country":"CH","industry_score":0.1}`,
			200, "low",
		},
		{
			"missing tenant",
			"",
			`{"entity_id":"e3"}`,
			401, "",
		},
		{
			"bad json",
			"tnt_abcdefghijkl",
			`not json`,
			400, "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/v1/risk/score",
				strings.NewReader(tt.body))
			if tt.tenantID != "" {
				req = newTenantRequest("POST", "/api/v1/risk/score", tt.tenantID)
				req.Body = httptest.NewRequest("POST", "/", strings.NewReader(tt.body)).Body
			}
			rr := httptest.NewRecorder()
			handleRiskScore(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
			if tt.wantLevel != "" {
				var body map[string]interface{}
				json.NewDecoder(rr.Body).Decode(&body)
				data := body["data"].(map[string]interface{})
				if data["risk_level"] != tt.wantLevel {
					t.Errorf("level = %v, want %s", data["risk_level"], tt.wantLevel)
				}
			}
		})
	}
}
