package screening

import (
	"io"
	"strings"
	"testing"
)

func TestParseEmbeddingResponse(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		status  int
		wantLen int
		wantErr bool
	}{
		{
			name:    "valid response",
			body:    `{"data":[{"embedding":[0.1,0.2,0.3]}]}`,
			status:  200,
			wantLen: 3,
		},
		{
			name:    "non-200 status",
			body:    `{"error":"bad"}`,
			status:  400,
			wantErr: true,
		},
		{
			name:    "empty data",
			body:    `{"data":[]}`,
			status:  200,
			wantErr: true,
		},
		{
			name:    "invalid json",
			body:    `{bad`,
			status:  200,
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := io.NopCloser(strings.NewReader(tt.body))
			vec, err := parseEmbeddingResponse(r, tt.status)
			if tt.wantErr && err == nil {
				t.Error("expected error")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if !tt.wantErr && len(vec) != tt.wantLen {
				t.Errorf("got %d dims, want %d", len(vec), tt.wantLen)
			}
		})
	}
}
