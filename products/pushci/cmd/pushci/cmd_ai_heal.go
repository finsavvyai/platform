package main

import (
	"context"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/heal"
	"github.com/finsavvyai/pushci/internal/runner"
)

func cmdHeal(ctx context.Context) error {
	if wantsHelp(os.Args[2:]) {
		printSubUsage("heal",
			"pushci heal [--max=N] [--semantic]",
			"Self-healing loop: runs checks, applies AI fixes, repeats until passing (max 5 iterations).",
			[][2]string{
				{"--max=N", "Maximum heal iterations (default 5, max 9)"},
				{"--semantic", "Use semantic vector search to find similar fixes"},
			},
			[]string{
				"pushci heal",
				"pushci heal --max=3",
				"pushci heal --semantic",
			})
		return nil
	}
	if !requireProFeature("heal") {
		return fmt.Errorf("AI feature gated")
	}
	if hasFlag(os.Args, "--semantic") {
		return cmdHealSemantic(ctx)
	}
	root, _ := os.Getwd()
	client, err := getAIClient()
	if err != nil {
		return err
	}

	maxIterations := parseMaxIterations()
	cli.Header("PushCI Heal")
	cli.Info(fmt.Sprintf("Self-healing loop — up to %d iterations", maxIterations))

	sp := cli.NewSpinner()
	projects := detect.Scan(root)
	healer := heal.NewHealer(client)
	totalFixes := 0

	for iteration := 1; iteration <= maxIterations; iteration++ {
		fmt.Println()
		cli.Step(iteration, maxIterations, fmt.Sprintf("Iteration %d", iteration))

		sp.Start("Running checks...")
		run := runner.Execute(ctx, root, projects)
		sp.Stop(true)

		if run.Passed {
			cli.Success(fmt.Sprintf("All checks passing after %d iteration(s), %d fix(es)", iteration, totalFixes))
			return nil
		}

		cli.Warn(fmt.Sprintf("%d check(s) failing", countRunFailures(run)))
		sp.Start("AI diagnosing + fixing...")
		result, err := healer.Heal(ctx, run, root)
		sp.Stop(err == nil)

		if err != nil {
			cli.Error("Heal error: " + err.Error())
			continue
		}

		if !result.Fixed {
			result = tryAIFallback(ctx, client, run, root, result)
			if !result.Fixed {
				cli.Error("Could not find any fixes — stopping")
				break
			}
		}

		for _, fix := range result.Fixes {
			cli.Success(fmt.Sprintf("  [%s] %s → %s", fix.Check, fix.Pattern, fix.Action))
			totalFixes++
		}
	}

	return verifyFinal(ctx, root, projects, totalFixes, sp)
}
