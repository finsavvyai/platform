package main

import (
	"context"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/heal"
	"github.com/finsavvyai/pushci/internal/runner"
)

func parseMaxIterations() int {
	maxIterations := 5
	for _, a := range os.Args {
		if len(a) > 6 && a[:6] == "--max=" {
			if n := a[6:]; n >= "1" && n <= "9" {
				maxIterations = int(n[0] - '0')
			}
		}
	}
	return maxIterations
}

func countRunFailures(run *runner.Run) int {
	n := 0
	for _, r := range run.Results {
		if !r.Passed {
			n++
		}
	}
	return n
}

func tryAIFallback(ctx context.Context, client *ai.Client, run *runner.Run, root string, result *heal.HealResult) *heal.HealResult {
	cli.Warn("No fixes found — trying AI deep analysis...")
	for _, r := range run.Results {
		if r.Passed {
			continue
		}
		fix := aiFallbackFix(ctx, client, r, root)
		if fix != nil {
			if applyErr := heal.ApplyFix(root, fix); applyErr == nil {
				result.Fixes = append(result.Fixes, *fix)
				result.Fixed = true
			}
		}
	}
	return result
}

func verifyFinal(ctx context.Context, root string, projects []detect.Project, totalFixes int, sp *cli.Spinner) error {
	sp.Start("Final verification...")
	finalRun := runner.Execute(ctx, root, projects)
	sp.Stop(true)

	if finalRun.Passed {
		cli.Success(fmt.Sprintf("Pipeline healed — %d fixes applied", totalFixes))
		return nil
	}

	failCount := countRunFailures(finalRun)
	cli.Error(fmt.Sprintf("Pipeline still failing: %d check(s). Applied %d fix(es).", failCount, totalFixes))
	cli.Info("Try: pushci diagnose for detailed analysis")
	return fmt.Errorf("%d checks still failing", failCount)
}

func aiFallbackFix(ctx context.Context, client *ai.Client, r runner.Result, root string) *heal.Fix {
	if client == nil || !client.IsConfigured() {
		return nil
	}
	prompt := fmt.Sprintf("CI check '%s' failed with output:\n%s\n\nSuggest a one-line shell command to fix this.", r.Check, truncate(r.Output, 1500))
	resp, err := client.Ask(ctx, prompt)
	if err != nil || resp == "" {
		return nil
	}
	return &heal.Fix{Check: r.Check, Pattern: "AI deep analysis", Action: resp}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}
