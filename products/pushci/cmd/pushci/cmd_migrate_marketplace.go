package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
)

// cmdMigrateMarketplace fetches a GitHub Actions marketplace action's
// action.yml and generates a pushci.yml stage with `with:` entries
// pre-filled. Helpers live in the companion parse/render files.
func cmdMigrateMarketplace(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("migrate --action", flag.ContinueOnError)
	action := fs.String("action", "", "Action ref, e.g. actions/setup-node@v4")
	output := fs.String("output", "", "Append stage to this pushci.yml (default: stdout)")
	var inputs multiFlag
	fs.Var(&inputs, "input", "Input in key=value form; repeat for multiple")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *action == "" {
		return fmt.Errorf("--action is required (e.g. actions/setup-node@v4)")
	}
	cli.Header("PushCI Migrate: Marketplace Action")
	cli.Info(fmt.Sprintf("Resolving %s", *action))
	parsed, err := parseMarketplaceRef(*action)
	if err != nil {
		return err
	}
	yaml, sourceURL, err := fetchMarketplaceYaml(ctx, parsed)
	if err != nil {
		return fmt.Errorf("fetch action.yml: %w", err)
	}
	meta := parseMarketplaceYaml(yaml)
	cli.Success(fmt.Sprintf("Fetched %s — %d inputs", sourceURL, len(meta.inputs)))
	values := mergeInputDefaults(meta.inputs, parseInputFlags(inputs))
	stage := renderMarketplaceStage(parsed, meta.name, values)
	for _, w := range meta.warnings {
		cli.Warn(w)
	}
	if *output == "" {
		fmt.Println()
		fmt.Print(stage)
		return nil
	}
	return appendStageToFile(*output, stage)
}

// multiFlag collects repeated --input flags.
type multiFlag []string

func (m *multiFlag) String() string     { return strings.Join(*m, ",") }
func (m *multiFlag) Set(v string) error { *m = append(*m, v); return nil }

func parseInputFlags(flags []string) map[string]string {
	out := map[string]string{}
	for _, f := range flags {
		if idx := strings.IndexByte(f, '='); idx > 0 {
			out[f[:idx]] = f[idx+1:]
		}
	}
	return out
}

func mergeInputDefaults(inputs []marketplaceInput, supplied map[string]string) map[string]string {
	out := map[string]string{}
	for _, in := range inputs {
		if v, ok := supplied[in.name]; ok {
			out[in.name] = v
			continue
		}
		if in.required && in.def == "" {
			cli.Warn(fmt.Sprintf("required input %q has no default — supply --input %s=<value>", in.name, in.name))
			continue
		}
		if in.def != "" {
			out[in.name] = in.def
		}
	}
	return out
}

func appendStageToFile(path, stage string) error {
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err := io.WriteString(f, "\n"+stage); err != nil {
		return err
	}
	cli.Success(fmt.Sprintf("Appended stage to %s", path))
	return nil
}
