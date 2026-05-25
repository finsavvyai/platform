package api

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCreateWebhook(t *testing.T) {
	tests := []struct {
		name       string
		tenantID   string
		body       string
		wantStatus int
	}{
		{"valid", "tnt_abcdefghijkl",
			`{"url":"https://example.com/hook","secret":"s3cret","events":["case.created"]}`,
			201},
		{"no tenant", "", `{"url":"https://example.com/hook"}`, 401},
		{"invalid url", "tnt_abcdefghijkl",
			`{"url":"","secret":"s","events":["case.created"]}`,
			400},
		{"no events", "tnt_abcdefghijkl",
			`{"url":"https://example.com/hook","secret":"s","events":[]}`,
			400},
		{"bad json", "tnt_abcdefghijkl", `{bad`, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := newTenantRequest("POST", "/api/v1/webhooks", tt.tenantID)
			req.Body = httptest.NewRequest("POST", "/", strings.NewReader(tt.body)).Body
			rr := httptest.NewRecorder()
			handleCreateWebhook(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestListWebhooks(t *testing.T) {
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
			req := newTenantRequest("GET", "/api/v1/webhooks", tt.tenantID)
			rr := httptest.NewRecorder()
			handleListWebhooks(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}
