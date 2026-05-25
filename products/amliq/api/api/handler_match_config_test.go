package api

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGetMatchConfig(t *testing.T) {
	tests := []struct {
		name       string
		tenantID   string
		wantStatus int
	}{
		{"with tenant", "tnt_abcdefghijkl", 200},
		{"no tenant", "", 401},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("GET", "/api/v1/risk/match-config", tt.tenantID)
			rr := httptest.NewRecorder()
			handleGetMatchConfig(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestUpdateMatchConfig(t *testing.T) {
	tests := []struct {
		name       string
		tenantID   string
		body       string
		wantStatus int
	}{
		{"valid", "tnt_abcdefghijkl",
			`{"fuzzy_threshold":0.8,"embedding_threshold":0.85,"min_confidence":0.7}`,
			200},
		{"no tenant", "", `{"fuzzy_threshold":0.8}`, 401},
		{"bad fuzzy", "tnt_abcdefghijkl", `{"fuzzy_threshold":1.5}`, 400},
		{"bad embedding", "tnt_abcdefghijkl", `{"embedding_threshold":-0.1}`, 400},
		{"bad confidence", "tnt_abcdefghijkl", `{"min_confidence":2.0}`, 400},
		{"bad json", "tnt_abcdefghijkl", `{bad`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("PUT", "/api/v1/risk/match-config", tt.tenantID)
			req.Body = httptest.NewRequest("PUT", "/", strings.NewReader(tt.body)).Body
			rr := httptest.NewRecorder()
			handleUpdateMatchConfig(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
			if tt.wantStatus == 200 {
				var body map[string]interface{}
				json.NewDecoder(rr.Body).Decode(&body)
				data := body["data"].(map[string]interface{})
				if data["message"] != "match config updated" {
					t.Errorf("unexpected message: %v", data["message"])
				}
			}
		})
	}
}
