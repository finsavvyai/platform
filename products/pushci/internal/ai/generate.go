package ai

import (
	"context"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/detect"
)

const generateSystem = `You are an expert DevOps architect.
Generate production-grade pushci.yml for PushCI.dev.
Return only valid YAML inside a fenced code block. No explanation.

Schema (required):
  on: [push, pull_request]
  stages:
    - name: <stage-name>
      checks:
        - name: <label>
          run: <shell command>

Rules:
- Use real shell commands (e.g. "go test ./..." not "test")
- Group checks into stages: install, build, test, lint
- Never use GitHub Actions syntax (uses:, with:, steps:)
- No placeholder commands like "build" without a run: field`

// GeneratePipeline asks Claude to create a pushci.yml for the repo.
func GeneratePipeline(ctx context.Context, client *Client, projects []detect.Project) (string, error) {
	summary := buildRepoSummary(projects)
	if !client.IsConfigured() {
		return defaultYAML(projects), nil
	}
	text, err := client.AskWithSystem(ctx, generateSystem,
		fmt.Sprintf("Repository summary:\n%s", summary))
	if err != nil {
		return defaultYAML(projects), nil
	}
	return extractYAML(text), nil
}

func buildRepoSummary(projects []detect.Project) string {
	var b strings.Builder
	for _, p := range projects {
		fmt.Fprintf(&b, "- %s in %s", p.Stack, p.Dir)
		if p.Framework != "" {
			fmt.Fprintf(&b, " (framework: %s)", p.Framework)
		}
		if p.BuildTool != "" {
			fmt.Fprintf(&b, " [build: %s]", p.BuildTool)
		}
		b.WriteString("\n")
	}
	return b.String()
}

func extractYAML(text string) string {
	start := strings.Index(text, "```yaml")
	if start == -1 {
		start = strings.Index(text, "```")
	}
	if start == -1 {
		return text
	}
	start = strings.Index(text[start:], "\n") + start + 1
	end := strings.Index(text[start:], "```")
	if end == -1 {
		return text[start:]
	}
	return text[start : start+end]
}
