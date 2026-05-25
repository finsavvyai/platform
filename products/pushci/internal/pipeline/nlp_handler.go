package pipeline

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/ai"
)

// NLPGenerate handles "deploy to staging on PR" style commands.
func NLPGenerate(ctx context.Context, client *ai.Client, instruction, root string) (string, error) {
	cfgPath := filepath.Join(root, "pushci.yml")
	existing := ""
	if data, err := os.ReadFile(cfgPath); err == nil {
		existing = string(data)
	}

	if !client.IsConfigured() {
		return "", fmt.Errorf("AI not configured for NLP pipeline generation")
	}

	prompt := fmt.Sprintf(`Current pipeline config:
%s

User instruction: %s

Modify the pipeline YAML to fulfill the instruction.
Return the complete updated YAML in a code block.`, existing, instruction)

	text, err := client.AskWithSystem(ctx, fixSystem, prompt)
	if err != nil {
		return "", fmt.Errorf("nlp generate: %w", err)
	}
	yaml := extractYAMLBlock(text)
	if yaml == "" {
		return "", fmt.Errorf("could not generate valid pipeline from instruction")
	}
	return yaml, nil
}

// ApplyNLPConfig writes the generated config to pushci.yml.
func ApplyNLPConfig(root, yamlContent string) error {
	cfgPath := filepath.Join(root, "pushci.yml")
	return os.WriteFile(cfgPath, []byte(yamlContent), 0o644)
}
