package pipeline

import (
	"context"
	"testing"

	"github.com/finsavvyai/pushci/internal/ai"
)

func TestFixPipelineLocal(t *testing.T) {
	tests := []struct {
		name  string
		req   FixRequest
		fixed bool
	}{
		{"no changes", FixRequest{Root: t.TempDir()}, false},
		{"with add change", FixRequest{
			Root:    t.TempDir(),
			Changes: []Change{{Type: ChangeAdd, Description: "New Go project", Suggestion: "go-build"}},
		}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := ai.NewClient() // no API key set
			result, err := FixPipeline(context.Background(), client, tt.req)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Fixed != tt.fixed {
				t.Errorf("fixed = %v, want %v", result.Fixed, tt.fixed)
			}
		})
	}
}

func TestExtractYAMLBlock(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"with yaml block", "```yaml\nname: test\n```", "name: test\n"},
		{"with plain block", "```\nname: test\n```", "name: test\n"},
		{"no block", "name: test", "name: test"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractYAMLBlock(tt.input)
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}
