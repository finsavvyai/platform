package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWidgetJS(t *testing.T) {
	tests := []struct {
		name       string
		wantStatus int
		wantType   string
	}{
		{
			name:       "serves javascript",
			wantStatus: http.StatusOK,
			wantType:   "application/javascript",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/widget/widget.js", nil)
			rr := httptest.NewRecorder()
			handler := &IFrameHandler{}
			handler.ServeWidget(rr, req)
			if rr.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
			ct := rr.Header().Get("Content-Type")
			if ct != tt.wantType {
				t.Errorf("content-type = %q, want %q", ct, tt.wantType)
			}
			if rr.Body.Len() == 0 {
				t.Error("empty body")
			}
		})
	}
}

func TestIsDomainAllowed(t *testing.T) {
	tests := []struct {
		name    string
		origin  string
		allowed []string
		want    bool
	}{
		{"wildcard", "https://example.com", []string{"*"}, true},
		{"exact match", "https://app.acme.com", []string{"acme.com"}, true},
		{"no match", "https://evil.com", []string{"acme.com"}, false},
		{"empty allowed", "https://any.com", []string{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isDomainAllowed(tt.origin, tt.allowed)
			if got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}
