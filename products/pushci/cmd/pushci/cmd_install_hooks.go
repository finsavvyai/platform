package main

import (
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
)

// cmdInstallHooks installs the PushCI pre-push hook into the current repo.
// This is the explicit opt-in path introduced for teddk bug #4 so that
// `pushci init` no longer silently writes into .git/hooks/ on every run.
//
// The write is idempotent (an existing PushCI-generated hook is refreshed
// in place) and never clobbers a hand-written user hook — see hooks.go
// for the signature-based safety check.
func cmdInstallHooks(args []string) error {
	if wantsHelp(args) {
		printSubUsage("install-hooks",
			"pushci install-hooks",
			"Install (or refresh) the PushCI pre-push hook in the current git repo. Idempotent. Custom user hooks are never overwritten.",
			nil,
			[]string{
				"pushci install-hooks     # one-time opt-in after `pushci init`",
			})
		return nil
	}
	cli.Header("PushCI Install Hooks")
	root, _ := os.Getwd()
	installGitHook(root)
	return nil
}
