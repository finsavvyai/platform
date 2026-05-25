package main

import (
	"context"
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/voice"
)

// voiceInstallCmd implements `pushci voice install <https-url>`.
// Adds-only — never overwrites a user's existing persona on name
// collision, so a remote file can't silently change a user's
// customization. Reports the count of newly added personas and
// the resolved local file path so the user can re-open it.
func voiceInstallCmd(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("voice install: usage: pushci voice install <https-url>")
	}
	src := args[0]
	added, dest, err := voice.InstallFromURL(ctx, src)
	if err != nil {
		return err
	}
	if added == 0 {
		cli.Warn(fmt.Sprintf("No new personas added (all entries from %s already exist or were invalid).", src))
		return nil
	}
	cli.Success(fmt.Sprintf("Installed %d persona(s) from %s into %s", added, src, dest))
	cli.Info("Run `pushci voice list` to see them.")
	return nil
}
