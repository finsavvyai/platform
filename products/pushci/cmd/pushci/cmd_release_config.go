package main

import (
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
)

func checkGoreleaserConfig(root string) error {
	for _, name := range []string{".goreleaser.yml", ".goreleaser.yaml"} {
		if _, err := os.Stat(root + "/" + name); err == nil {
			cli.Info(fmt.Sprintf("%s Found %s", cli.CheckMark(), name))
			return nil
		}
	}
	fmt.Println()
	cli.Error(".goreleaser.yml not found")
	fmt.Println()
	cli.Info(cli.Bold("pushci release") + " is for distributing Go CLI binaries via goreleaser.")
	cli.Info("It cross-compiles for 6 platforms, creates a GitHub Release,")
	cli.Info("and updates the Homebrew tap. If that's not what you need:")
	fmt.Println()
	cli.Info("  " + cli.Blue("pushci run --with-deploy") + "  Run CI + deploy your app locally")
	cli.Info("  " + cli.Blue("pushci deploy") + "             Deploy only (skip CI stages)")
	cli.Info("  " + cli.Blue("goreleaser init") + "           Create a .goreleaser.yml if you DO want binary releases")
	fmt.Println()
	return fmt.Errorf("no .goreleaser.yml — see suggestions above")
}
