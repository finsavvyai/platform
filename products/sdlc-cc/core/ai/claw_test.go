package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewClawClient(t *testing.T) {
	c := NewClawClient("key-123", "proj-abc")
	if c.APIKey != "key-123" {
		t.Error("APIKey mismatch")
	}
	if c.ProjectID != "proj-abc" {
		t.Error("ProjectID mismatch")
	}
	if c.Endpoint != ClawEndpoint {
		t.Errorf("Endpoint = %s, want %s", c.Endpoint, ClawEndpoint)
	}
}

func TestPrompt(t *testing.T) {
	tests := []struct {
		name       string
		status     int
		response   clawResponse
		wantErr    bool
		wantText   string
	}{
		{
			name:     "success",
			status:   200,
			response: clawResponse{Text: "AI says hello"},
			wantText: "AI says hello",
		},
		{
			name:     "server error",
			status:   500,
			response: clawResponse{Error: "internal"},
			wantErr:  true,
		},
		{
			name:     "api error in body",
			status:   200,
			response: clawResponse{Error: "rate limited"},
			wantErr:  true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(
				func(w http.ResponseWriter, r *http.Request) {
					if r.Header.Get("Authorization") != "Bearer test-key" {
						t.Error("missing auth header")
					}
					w.WriteHeader(tt.status)
					json.NewEncoder(w).Encode(tt.response)
				},
			))
			defer srv.Close()

			c := NewClawClient("test-key", "proj-1")
			c.Endpoint = srv.URL
			got, err := c.Prompt(
				context.Background(), "system", "user", 100,
			)
			if tt.wantErr && err == nil {
				t.Fatal("expected error")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !tt.wantErr && got != tt.wantText {
				t.Errorf("got %q, want %q", got, tt.wantText)
			}
		})
	}
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		input string
		max   int
		want  string
	}{
		{"short", 10, "short"},
		{"longer string", 5, "longe"},
	}
	for _, tt := range tests {
		got := truncate([]byte(tt.input), tt.max)
		if got != tt.want {
			t.Errorf("truncate(%q, %d) = %q, want %q",
				tt.input, tt.max, got, tt.want)
		}
	}
}
