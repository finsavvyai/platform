package ai

import (
	"context"
	"fmt"
)

const convertSystem = `You are an expert at CI/CD pipeline migration.
Convert GitHub Actions YAML to PushCI.dev YAML format.

PushCI.dev syntax:
  on: [push, pull_request]
  checks:
    - build
    - test
    - lint
  deploy:
    target: <cloudflare-pages|aws-ecs|docker|etc>
    trigger: merge to main

Return only valid PushCI YAML in a code block. No explanation.`

// ConvertGitHubActions converts a GitHub Actions workflow to PushCI YAML.
func ConvertGitHubActions(ctx context.Context, client *Client, actionsYAML string) (string, error) {
	if !client.IsConfigured() {
		return "", fmt.Errorf("ANTHROPIC_API_KEY required for conversion")
	}

	prompt := fmt.Sprintf("Convert this GitHub Actions workflow to PushCI.dev YAML:\n\n```yaml\n%s\n```", actionsYAML)
	text, err := client.AskWithSystem(ctx, convertSystem, prompt)
	if err != nil {
		return "", fmt.Errorf("conversion failed: %w", err)
	}

	return extractYAML(text), nil
}

const explainSystem = `You are a CI/CD debugging expert.
Diagnose the CI failure in 2-3 sentences.
Then suggest a specific fix command or code change.
Format:
DIAGNOSIS: <explanation>
FIX: <specific action>`

// ExplainFailure asks Claude to diagnose a CI failure.
func ExplainFailure(ctx context.Context, client *Client, check, output string) (string, error) {
	if !client.IsConfigured() {
		return "", fmt.Errorf("ANTHROPIC_API_KEY required")
	}

	prompt := fmt.Sprintf("CI check failed.\n\nCheck: %s\nOutput (last 1500 chars):\n%s",
		check, truncateForAPI(output))
	return client.AskWithSystem(ctx, explainSystem, prompt)
}

func truncateForAPI(s string) string {
	if len(s) > 1500 {
		return s[len(s)-1500:]
	}
	return s
}
