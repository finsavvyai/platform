package intel

import (
	"context"
	"testing"

	"github.com/finsavvyai/pushci/internal/ai"
)

func TestSuggestFixLocal(t *testing.T) {
	tests := []struct {
		name    string
		rc      *RootCause
		wantErr bool
	}{
		{"with fix steps", &RootCause{
			Summary:  "Missing dep",
			Category: "dependency",
			FixSteps: []string{"npm install"},
		}, false},
		{"no fix steps", &RootCause{
			Summary:  "Unknown",
			Category: "unknown",
		}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pr, err := SuggestFix(context.Background(), ai.NewClient(), tt.rc, "output")
			if tt.wantErr && err == nil {
				t.Error("expected error")
			}
			if !tt.wantErr && pr == nil {
				t.Error("expected non-nil suggestion")
			}
			if !tt.wantErr && pr.Title == "" {
				t.Error("expected non-empty title")
			}
		})
	}
}

func TestParsePRResponse(t *testing.T) {
	input := `TITLE: fix: add missing lodash dependency
DESCRIPTION: Auto-fix for missing npm dependency
CMD: npm install lodash --save
CMD: npm audit fix`

	pr := parsePRResponse(input)
	if pr.Title != "fix: add missing lodash dependency" {
		t.Errorf("title = %q", pr.Title)
	}
	if len(pr.FixCommands) != 2 {
		t.Errorf("commands = %d, want 2", len(pr.FixCommands))
	}
}
