package ai

import (
	"context"
	"fmt"
)

const extendSystem = `You edit an existing pushci.yml by a natural-language instruction.

Rules:
- Return ONLY the full updated YAML inside a fenced code block. No commentary.
- Preserve all existing stages and checks unless the user asks to remove or replace them.
- Keep the PushCI schema: on:, stages:[name,checks:[name,run:]], optional deploy:.
- Never emit GitHub Actions syntax (uses:, with:, steps:).
- If the user asks for something impossible in the schema, add it to a new stage as a shell command that approximates the intent.
- If adding deploy targets, put them under a top-level deploy: list with trigger/run/target fields — not nested under stages.`

// ExtendPipeline asks the AI provider to modify the given pushci.yml per
// userPrompt. Returns the new YAML as a string. If the client is not
// configured, returns an error — the caller should surface that.
func ExtendPipeline(ctx context.Context, client *Client, currentYAML, userPrompt string) (string, error) {
	if !client.IsConfigured() {
		return "", fmt.Errorf("no AI provider configured; set ANTHROPIC_API_KEY, GROQ_API_KEY, or PUSHCI token")
	}
	prompt := fmt.Sprintf(
		"Current pushci.yml:\n```yaml\n%s\n```\n\nRequested change: %s",
		currentYAML, userPrompt,
	)
	text, err := client.AskWithSystem(ctx, extendSystem, prompt)
	if err != nil {
		return "", err
	}
	out := extractYAML(text)
	if out == "" {
		return "", fmt.Errorf("AI returned empty response")
	}
	return out, nil
}
