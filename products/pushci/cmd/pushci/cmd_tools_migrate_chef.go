package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/migrate"
)

// isChefTarget returns true when the migrate target looks like a Chef
// cookbook layout — either a directory containing cookbooks/ (or the
// cookbooks/ dir itself) or a path ending in metadata.rb.
func isChefTarget(path string) bool {
	if path == "" {
		return false
	}
	if strings.HasSuffix(filepath.Base(path), "metadata.rb") {
		return true
	}
	info, err := os.Stat(path) // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
	if err != nil || !info.IsDir() {
		return false
	}
	if filepath.Base(path) == "cookbooks" {
		return true
	}
	if s, err := os.Stat(filepath.Join(path, "cookbooks")); err == nil && s.IsDir() { // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
		return true
	}
	return false
}

func migrateChef(path string, args []string) error {
	result := migrate.ConvertChef(path)
	cli.Success(fmt.Sprintf(
		"Converted Chef cookbook layout: %d cookbook(s), kitchen=%v, berks=%v",
		len(result.Cookbooks), result.HasKitchen, result.HasBerksfile))
	if len(result.Cookbooks) > 0 {
		cli.Info("Cookbooks: " + strings.Join(result.Cookbooks, ", "))
	}
	showMigrateEnvVarsSecret(result.EnvVarsNeeded)
	for _, w := range result.Warnings {
		cli.Warn(w)
	}
	fmt.Println()
	fmt.Println(cli.Dim(result.PushCIYAML))
	return writeMigrateResult(args, result.PushCIYAML)
}
