package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/migrate"
)

// cmdImportActions converts GitHub Actions workflows in .github/workflows/
// (or --input <path>) into a single pushci.yml. Reuses migrate.ConvertActions
// for the YAML→PushCI translation so the parsing surface stays in one place.
func cmdImportActions(ctx context.Context, args []string) error {
	if wantsHelp(args) {
		fmt.Println("pushci import actions [--input PATH] [--output FILE] [--force]")
		fmt.Println()
		fmt.Println("Convert GitHub Actions workflows into pushci.yml.")
		fmt.Println("Default --input is .github/workflows/. Default --output is pushci.yml.")
		fmt.Println("Use --output - to write to stdout.")
		return nil
	}
	_ = ctx

	fs := flag.NewFlagSet("import actions", flag.ContinueOnError)
	input := fs.String("input", "", "workflow file or dir (default: .github/workflows/)")
	output := fs.String("output", "pushci.yml", "output file (use - for stdout)")
	force := fs.Bool("force", false, "overwrite output if it exists")
	if err := fs.Parse(args); err != nil {
		return err
	}

	files, err := discoverActionsWorkflows(*input)
	if err != nil {
		return fmt.Errorf("discover workflows: %w", err)
	}
	if len(files) == 0 {
		return fmt.Errorf("no workflows found under %q", actionsSearchRoot(*input))
	}

	cli.Header("PushCI Import: GitHub Actions")
	cli.Info(fmt.Sprintf("Found %d workflow file(s)", len(files)))

	combined, warnings, envVars := convertActionsFiles(files)
	if err := writeActionsOutput(*output, combined, *force); err != nil {
		return err
	}
	reportActionsImport(*output, len(files), warnings, envVars)
	return nil
}

// reportActionsImport prints summary info: warnings (skipped actions, matrix
// jobs that collapse to sequential) and the secrets the user must wire up.
// Goes to stderr so a `pushci import actions --output -` pipe stays clean.
func reportActionsImport(output string, fileCount int, warnings []string, envVars []migrate.EnvVarRef) {
	if len(warnings) > 0 {
		cli.Warn(fmt.Sprintf("%d conversion warning(s):", len(warnings)))
		for _, w := range warnings {
			fmt.Fprintln(os.Stderr, "  - "+w)
		}
	}
	if len(envVars) > 0 {
		fmt.Fprintln(os.Stderr, "")
		cli.Info("Secrets referenced in workflows — set each with:")
		seen := map[string]bool{}
		for _, e := range envVars {
			key := e.Name + "|" + e.UsedIn
			if seen[key] {
				continue
			}
			seen[key] = true
			fmt.Fprintln(os.Stderr, "  "+e.Suggestion)
		}
	}
	if output == "-" {
		return
	}
	cli.Success(fmt.Sprintf("Wrote %s (from %d workflow file(s))", output, fileCount))
}

// actionsSearchRoot reports the path that was searched, for error messages.
func actionsSearchRoot(input string) string {
	if input == "" {
		return ".github/workflows/"
	}
	if strings.HasSuffix(input, "/") {
		return input
	}
	return input
}
