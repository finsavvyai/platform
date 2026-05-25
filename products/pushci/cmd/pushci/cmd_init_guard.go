package main

import (
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
)

// guardExistingPushciYml aborts init if pushci.yml already exists unless
// --force/-f is passed. When --force is passed we back up the existing
// file to .pushci.yml.bak so a botched regen can always be reverted.
//
// Returns (true, nil) when the caller should abort without error (i.e.
// a pushci.yml already existed and --force was not set). Returns
// (false, nil) when init may continue.
func guardExistingPushciYml(root string) (bool, error) {
	existing := root + "/pushci.yml"
	force := hasFlag(os.Args[2:], "--force", "-f")
	if _, err := os.Stat(existing); err != nil {
		return false, nil // no existing file — proceed
	}
	if !force {
		cli.Warn("pushci.yml already exists at " + existing)
		cli.Info("Re-run with " + cli.Blue("pushci init --force") + " to regenerate (backs up to .pushci.yml.bak)")
		cli.Info("Or edit " + cli.Dim("pushci.yml") + " by hand — " + cli.Blue("pushci run") + " to execute it")
		return true, nil
	}
	backup := root + "/.pushci.yml.bak"
	if data, readErr := os.ReadFile(existing); readErr == nil {
		if err := os.WriteFile(backup, data, 0644); err != nil { // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
			cli.Warn("Could not back up existing pushci.yml: " + err.Error())
		} else {
			cli.Info("Backed up existing pushci.yml to .pushci.yml.bak")
		}
	}
	return false, nil
}
