package nlp

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/heal"
	"github.com/finsavvyai/pushci/internal/pipeline"
	"github.com/finsavvyai/pushci/internal/runner"
)

func execOptimize(ctx context.Context, root string) (string, error) {
	cfgPath := filepath.Join(root, "pushci.yml")
	data, err := os.ReadFile(cfgPath)
	if err != nil {
		return "No pushci.yml found. Run `pushci init` first.", nil
	}
	client := ai.NewClient()
	if !client.IsConfigured() {
		return localOptimize(string(data)), nil
	}
	prompt := fmt.Sprintf("Analyze this CI pipeline and suggest optimizations:\n```yaml\n%s\n```", data)
	text, err := client.Ask(ctx, prompt)
	if err != nil {
		return localOptimize(string(data)), nil
	}
	return text, nil
}

func localOptimize(config string) string {
	var tips []string
	if !strings.Contains(config, "cache") {
		tips = append(tips, "Add caching for dependencies (node_modules, .cache)")
	}
	if !strings.Contains(config, "parallel") {
		tips = append(tips, "Enable parallel execution for independent checks")
	}
	if strings.Count(config, "- name:") > 5 {
		tips = append(tips, "Consider grouping related checks to reduce overhead")
	}
	if len(tips) == 0 {
		return "Pipeline looks optimized. No suggestions."
	}
	return "Optimization suggestions:\n- " + strings.Join(tips, "\n- ")
}

func execFixPipeline(ctx context.Context, root string) (string, error) {
	client := ai.NewClient()
	cfgPath := filepath.Join(root, "pushci.yml")
	config := ""
	if data, err := os.ReadFile(cfgPath); err == nil {
		config = string(data)
	}
	req := pipeline.FixRequest{Root: root, Config: config}
	result, err := pipeline.FixPipeline(ctx, client, req)
	if err != nil {
		return "", err
	}
	if !result.Fixed {
		return "Pipeline looks healthy. No fixes needed.", nil
	}
	return fmt.Sprintf("Fixed pipeline:\n%s\n\n%s", result.NewConfig, result.Suggestion), nil
}

func execGenerate(ctx context.Context, root string) (string, error) {
	client := ai.NewClient()
	projects := detect.Scan(root)
	yaml, err := ai.GeneratePipeline(ctx, client, projects)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("Generated pipeline:\n```yaml\n%s\n```", yaml), nil
}

func execHeal(ctx context.Context, root string) (string, error) {
	client := ai.NewClient()
	projects := detect.Scan(root)
	run := runner.Execute(ctx, root, projects)
	if run.Passed {
		return "All checks passed. Nothing to heal.", nil
	}
	healer := heal.NewHealer(client)
	result, err := healer.Heal(ctx, run, root)
	if err != nil {
		return "", fmt.Errorf("heal: %w", err)
	}
	if !result.Fixed {
		return "Could not auto-fix the failures.", nil
	}
	var fixes []string
	for _, f := range result.Fixes {
		fixes = append(fixes, fmt.Sprintf("- [%s] %s", f.Pattern, f.Action))
	}
	return fmt.Sprintf("Applied %d fixes:\n%s", len(result.Fixes), strings.Join(fixes, "\n")), nil
}
