package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/cli"
)

func cmdUninstall() error {
	cli.Header("PushCI Uninstall")
	dir, _ := os.Getwd()
	removed := 0

	// Remove pre-push hook
	hookPath := filepath.Join(dir, ".git", "hooks", "pre-push")
	if data, err := os.ReadFile(hookPath); err == nil {
		if contains(string(data), "pushci") || contains(string(data), "PushCI") {
			if err := os.Remove(hookPath); err == nil {
				cli.Success("Removed pre-push hook")
				removed++
			}
		} else {
			cli.Info("Pre-push hook exists but isn't PushCI — skipped")
		}
	} else {
		cli.Info("No pre-push hook found")
	}

	// Remove pushci.yml
	ymlPath := filepath.Join(dir, "pushci.yml")
	if _, err := os.Stat(ymlPath); err == nil {
		if err := os.Remove(ymlPath); err == nil {
			cli.Success("Removed pushci.yml")
			removed++
		}
	}

	// Remove .pushci directory
	pushciDir := filepath.Join(dir, ".pushci")
	if _, err := os.Stat(pushciDir); err == nil {
		if err := os.RemoveAll(pushciDir); err == nil {
			cli.Success("Removed .pushci/ directory")
			removed++
		}
	}

	fmt.Println()
	if removed > 0 {
		cli.Success(fmt.Sprintf("Removed %d item(s). PushCI is uninstalled from this project.", removed))
	} else {
		cli.Info("Nothing to remove — PushCI wasn't installed in this project.")
	}
	cli.Info("To uninstall globally: npm uninstall -g pushci")
	return nil
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsSubstr(s, sub))
}

func containsSubstr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
