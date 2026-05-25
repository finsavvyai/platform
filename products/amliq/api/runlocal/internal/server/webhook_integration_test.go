package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/platform"
)

func TestWebhookIntegrationFlows(t *testing.T) {
	pushEvent := &platform.Event{
		Action: "push", Repo: "o/r",
		Branch: "main", SHA: "abc123",
	}

	tests := []struct {
		name     string
		provider string
		register bool
		event    *platform.Event
		wantCode int
		wantBody string
	}{
		{
			name:     "github registered returns 200",
			provider: "github",
			register: true,
			event:    pushEvent,
			wantCode: 200,
			wantBody: "accepted",
		},
		{
			name:     "gitlab registered returns 200",
			provider: "gitlab",
			register: true,
			event:    pushEvent,
			wantCode: 200,
			wantBody: "accepted",
		},
		{
			name:     "unregistered provider returns 404",
			provider: "bitbucket",
			register: false,
			wantCode: 404,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := New("/tmp", nil)
			if tt.register {
				srv.RegisterProvider(tt.provider, &mockProvider{
					event: tt.event,
				})
			}
			h := srv.Handler()
			path := "/webhook/" + tt.provider
			req := httptest.NewRequest(http.MethodPost, path,
				strings.NewReader(`{}`))
			w := httptest.NewRecorder()
			h.ServeHTTP(w, req)

			if w.Code != tt.wantCode {
				t.Errorf("status = %d, want %d", w.Code, tt.wantCode)
			}
			if tt.wantBody != "" && !strings.Contains(w.Body.String(), tt.wantBody) {
				t.Errorf("body = %q, want substring %q", w.Body.String(), tt.wantBody)
			}
		})
	}
}
