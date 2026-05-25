package intel

import (
	"context"
	"fmt"

	"github.com/finsavvyai/pushci/internal/ai"
)

// PRSuggestion holds an AI-generated fix suggestion ready for a PR.
type PRSuggestion struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Branch      string   `json:"branch"`
	FixCommands []string `json:"fix_commands"`
	FilePatch   string   `json:"file_patch"`
}

const suggestSystem = `You are a CI/CD auto-fix agent for PushCI.dev.
Given a failure, suggest a specific fix as a PR.
Respond in this exact format:
TITLE: <short PR title>
DESCRIPTION: <1-2 sentence description>
CMD: <shell command to apply fix>
CMD: <optional additional command>
If it's a file change instead, use:
PATCH: <file path>
<file content>`

// SuggestFix generates a PR-ready fix suggestion for a failure.
func SuggestFix(ctx context.Context, client *ai.Client, rc *RootCause, output string) (*PRSuggestion, error) {
	if client == nil || !client.IsConfigured() {
		return localSuggestion(rc)
	}
	prompt := fmt.Sprintf("Root cause: %s\nCategory: %s\nFix steps: %v\nOutput:\n%s",
		rc.Summary, rc.Category, rc.FixSteps, truncateStr(output, 1500))
	text, err := client.AskWithSystem(ctx, suggestSystem, prompt)
	if err != nil {
		return localSuggestion(rc)
	}
	return parseSuggestion(text, rc)
}

func localSuggestion(rc *RootCause) (*PRSuggestion, error) {
	if len(rc.FixSteps) == 0 {
		return nil, fmt.Errorf("no fix steps available")
	}
	return &PRSuggestion{
		Title:       fmt.Sprintf("fix: %s", rc.Summary),
		Description: fmt.Sprintf("Auto-fix for %s failure", rc.Category),
		FixCommands: rc.FixSteps,
	}, nil
}

func parseSuggestion(text string, rc *RootCause) (*PRSuggestion, error) {
	pr := parsePRResponse(text)
	if pr.Title == "" {
		pr.Title = fmt.Sprintf("fix: %s", rc.Summary)
	}
	return pr, nil
}
