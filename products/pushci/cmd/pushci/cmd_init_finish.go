package main

import (
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// printInitHelp renders the `pushci init --help` output. Factored out
// of cmdInit to keep the top-level flow under the 100-line CI cap.
func printInitHelp() {
	printSubUsage("init",
		"pushci init [--force] [--non-interactive] [--install-hooks]",
		"Detect the stack and generate pushci.yml. Refuses to overwrite an existing pushci.yml unless --force is passed. Does NOT install a git pre-push hook unless --install-hooks is explicit (teddk bug #4 — no silent writes into guest repos).",
		[][2]string{
			{"--force, -f", "overwrite existing pushci.yml + skip all interactive prompts (backs up to .pushci.yml.bak)"},
			{"--non-interactive, --yes, -y", "skip all prompts (accept defaults) without overwriting an existing pushci.yml"},
			{"--install-hooks", "also install the git pre-push hook — opt-in, never silent"},
		},
		[]string{
			"pushci init                       # fresh repo, interactive",
			"pushci init --non-interactive    # CI-safe, accept defaults",
			"pushci init --force               # regenerate + non-interactive",
			"PUSHCI_NON_INTERACTIVE=1 pushci init  # env-var equivalent",
		})
}

// finishInit runs the post-write banner: success line, summary,
// telemetry, auth guide, webhook notice.
func finishInit(pipe *config.Pipeline, projects []detect.Project) {
	cli.Success("Created pushci.yml")
	printPipelineSummary(pipe)
	fmt.Println()
	cli.Info("Run " + cli.Blue("pushci run") + " to execute your pipeline")
	cli.Info("Edit " + cli.Dim("pushci.yml") + " to customize stages, deploy targets, and branch rules")
	if !hasFlag(os.Args[2:], "--install-hooks") {
		cli.Info("Run " + cli.Blue("pushci install-hooks") + " to gate `git push` on your checks (opt-in)")
	}
	printInitAuthGuide()
	printTelemetryNotice()
	sendTelemetry("init", projects)
	if loadAuthToken() != "" {
		autoRegister()
		cli.Success("Project visible at " + cli.Blue("https://app.pushci.dev"))
		cli.Info("Webhook auto-installed — push events will trigger CI runs")
	}
}
