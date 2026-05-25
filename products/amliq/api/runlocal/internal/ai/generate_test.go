package ai

import (
	"strings"
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestBuildRepoSummary(t *testing.T) {
	tests := []struct {
		name     string
		projects []detect.Project
		contains []string
	}{
		{
			name: "multiple projects",
			projects: []detect.Project{
				{Stack: detect.Go, Dir: ".", BuildTool: ""},
				{Stack: detect.Node, Dir: "web", Framework: "nextjs", BuildTool: detect.ToolNpm},
			},
			contains: []string{"go in .", "node in web", "nextjs", "npm"},
		},
		{
			name:     "empty projects",
			projects: nil,
			contains: nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildRepoSummary(tt.projects)
			for _, c := range tt.contains {
				if !strings.Contains(got, c) {
					t.Errorf("summary missing %q in: %s", c, got)
				}
			}
		})
	}
}

func TestExtractYAMLFromCodeBlock(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "yaml code block",
			input: "Here is the config:\n```yaml\non: [push]\nchecks:\n  - build\n```\nDone.",
			want:  "on: [push]\nchecks:\n  - build\n",
		},
		{
			name:  "generic code block",
			input: "```\non: [push]\n```",
			want:  "on: [push]\n",
		},
		{
			name:  "no code block",
			input: "on: [push]\nchecks:\n  - build",
			want:  "on: [push]\nchecks:\n  - build",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractYAML(tt.input)
			if got != tt.want {
				t.Errorf("extractYAML =\n%q\nwant\n%q", got, tt.want)
			}
		})
	}
}

func TestBuildRepoSummaryFormat(t *testing.T) {
	projects := []detect.Project{
		{Stack: detect.Go, Dir: ".", Framework: "gin", BuildTool: ""},
	}
	got := buildRepoSummary(projects)
	if !strings.Contains(got, "framework: gin") {
		t.Error("summary should include framework when set")
	}
}

func TestExtractYAMLUnclosedBlock(t *testing.T) {
	input := "```yaml\non: [push]\n"
	got := extractYAML(input)
	if !strings.Contains(got, "on: [push]") {
		t.Errorf("unclosed block should return content, got %q", got)
	}
}
