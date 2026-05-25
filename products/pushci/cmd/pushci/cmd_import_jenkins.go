package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
)

// cmdImport dispatches `pushci import <target>` subcommands.
// Supported: `jenkins`, `actions` (GitHub Actions).
// Future targets: `gitlab-ci`, `circleci`, `bitrise`.
func cmdImport(ctx context.Context, args []string) error {
	if wantsHelp(args) || len(args) == 0 {
		printSubUsage("import",
			"pushci import <jenkins|actions> [flags]",
			"Import a pipeline definition from an external CI system into pushci.yml.",
			nil,
			[]string{
				"pushci import actions",
				"pushci import actions --input .github/workflows/ci.yml --output pushci.yml",
				"pushci import jenkins --url https://ci.example.com --job build --user alice --token XXX",
			})
		return nil
	}
	switch args[0] {
	case "jenkins":
		return cmdImportJenkins(ctx, args[1:])
	case "actions", "github-actions":
		return cmdImportActions(ctx, args[1:])
	default:
		return fmt.Errorf("unknown import target %q (try: jenkins, actions)", args[0])
	}
}

// cmdImportJenkins fetches a Jenkins job's config.xml, extracts the
// declarative Jenkinsfile, converts it to .pushci.yml, and writes the
// output (stdout by default, or --output path). Local parsing only —
// no hard dependency on the API beyond the Jenkins server.
func cmdImportJenkins(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("import jenkins", flag.ContinueOnError)
	url := fs.String("url", "", "Jenkins base URL (e.g. https://ci.example.com)")
	job := fs.String("job", "", "Jenkins job name")
	user := fs.String("user", "", "Jenkins username")
	token := fs.String("token", "", "Jenkins API token")
	output := fs.String("output", "", "write YAML to this file (default: stdout)")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *url == "" || *job == "" || *user == "" || *token == "" {
		return fmt.Errorf("--url, --job, --user, --token are all required")
	}

	cli.Header("PushCI Import: Jenkins")
	cli.Info(fmt.Sprintf("Fetching %s job %q", *url, *job))

	xml, err := fetchJenkinsConfigXML(ctx, *url, *job, *user, *token)
	if err != nil {
		return fmt.Errorf("fetch config.xml: %w", err)
	}
	script := extractJenkinsfileScript(xml)
	if strings.TrimSpace(script) == "" {
		return fmt.Errorf("no inline Jenkinsfile found — the job is SCM-backed; open the Jenkinsfile from the repo directly")
	}

	pipeline := parseJenkinsfile(script)
	yaml := renderPushciYAML(pipeline)

	if *output == "" {
		fmt.Print(yaml)
	} else {
		if err := os.WriteFile(*output, []byte(yaml), 0644); err != nil {
			return fmt.Errorf("write %s: %w", *output, err)
		}
		cli.Success(fmt.Sprintf("Wrote %d bytes to %s", len(yaml), *output))
	}

	cli.Info(fmt.Sprintf("Detected stack: %s", pipeline.Stack))
	cli.Info(fmt.Sprintf("Stages: %d", len(pipeline.Stages)))
	for _, w := range pipeline.Warnings {
		cli.Warn(w)
	}
	return nil
}
