package pipeline

import (
	"context"
	"fmt"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/detect"
)

// FixRequest describes what needs fixing in a pipeline.
type FixRequest struct {
	Root    string
	Error   string
	Config  string
	Changes []Change
}

// FixResult holds the AI-generated pipeline fix.
type FixResult struct {
	Fixed      bool
	NewConfig  string
	Suggestion string
}

const fixSystem = `You are a CI/CD pipeline expert for PushCI.dev.
The user's pipeline config has issues. Generate a corrected pushci.yml.
Return ONLY valid YAML in a code block. Keep the fix minimal.`

// FixPipeline uses AI to repair a broken pipeline configuration.
func FixPipeline(ctx context.Context, client *ai.Client, req FixRequest) (*FixResult, error) {
	if !client.IsConfigured() {
		return fixLocal(req)
	}
	prompt := buildFixPrompt(req)
	text, err := client.AskWithSystem(ctx, fixSystem, prompt)
	if err != nil {
		return fixLocal(req)
	}
	yaml := extractYAMLBlock(text)
	if yaml == "" {
		return fixLocal(req)
	}
	return &FixResult{Fixed: true, NewConfig: yaml, Suggestion: "AI-generated fix applied"}, nil
}

func buildFixPrompt(req FixRequest) string {
	prompt := fmt.Sprintf("Current config:\n```yaml\n%s\n```\n", req.Config)
	if req.Error != "" {
		prompt += fmt.Sprintf("\nError: %s\n", req.Error)
	}
	if len(req.Changes) > 0 {
		prompt += "\nRequired changes:\n"
		for _, c := range req.Changes {
			prompt += fmt.Sprintf("- [%s] %s\n", c.Type, c.Description)
		}
	}
	return prompt
}

func fixLocal(req FixRequest) (*FixResult, error) {
	if len(req.Changes) == 0 {
		return &FixResult{Fixed: false, Suggestion: "No changes detected"}, nil
	}
	projects := detect.Scan(req.Root)
	yaml := defaultFixYAML(projects, req.Changes)
	return &FixResult{Fixed: true, NewConfig: yaml, Suggestion: "Pattern-based fix"}, nil
}

func defaultFixYAML(projects []detect.Project, changes []Change) string {
	cfg := "on: [push, pull_request]\nchecks:\n"
	for _, p := range projects {
		cfg += fmt.Sprintf("  - name: %s\n    run: build\n", p.Stack)
	}
	for _, c := range changes {
		if c.Type == ChangeAdd {
			cfg += fmt.Sprintf("  - name: %s\n", c.Suggestion)
		}
	}
	return cfg
}
