package ai

import (
	"context"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/detect"
)

const generateSystem = `You are an expert DevOps architect.
Generate production-grade CI/CD YAML for PushCI.dev.
Return only valid YAML inside a code block. No explanation.`

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
	// Extract from ```yaml ... ``` block
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

func defaultYAML(projects []detect.Project) string {
	var checks []string
	for _, p := range projects {
		if p.Stack != detect.Docker {
			checks = append(checks, "  - build\n  - test")
			break
		}
	}
	return fmt.Sprintf("on: [push, pull_request]\nchecks:\n%s\n",
		strings.Join(checks, "\n"))
}
