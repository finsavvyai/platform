package main

import (
	"context"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/cli"
)

func cmdExtend(ctx context.Context) error {
	args := os.Args[2:]
	if wantsHelp(args) {
		printExtendHelp()
		return nil
	}

	prompt, flags := parseExtendArgs(args)
	if prompt == "" {
		printExtendHelp()
		return fmt.Errorf("missing instruction; example: pushci extend \"add e2e stage with playwright\"")
	}

	if err := requireExtendEntitlement(ctx); err != nil {
		return err
	}

	const yamlPath = "pushci.yml"
	// #nosec G304 G703 -- yamlPath is a compile-time constant
	currentBytes, err := os.ReadFile(yamlPath)
	if err != nil {
		return fmt.Errorf("read %s: %w (run `pushci init` first)", yamlPath, err)
	}
	current := string(currentBytes)

	client, err := getAIClient()
	if err != nil {
		return err
	}

	cli.Header("PushCI Extend")
	sp := cli.NewSpinner()
	sp.Start("AI editing pushci.yml...")
	next, err := ai.ExtendPipeline(ctx, client, current, prompt)
	sp.Stop(err == nil)
	if err != nil {
		return err
	}

	printExtendDiff(current, next)

	if flags.dryRun {
		cli.Info("Dry run — no changes written. Re-run without --dry-run to apply.")
		return nil
	}
	if !flags.yes && !confirmExtend() {
		cli.Info("Aborted. No changes written.")
		return nil
	}
	// #nosec G306 G703 -- yamlPath is a compile-time constant; 0644 matches user-readable config norms
	if err := os.WriteFile(yamlPath, []byte(next), 0o644); err != nil {
		return fmt.Errorf("write %s: %w", yamlPath, err)
	}
	cli.Success(fmt.Sprintf("Updated %s", yamlPath))
	return nil
}
