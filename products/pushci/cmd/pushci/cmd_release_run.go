package main

import (
	"os"
	"os/exec"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
)

func buildReleaseArgs(dryRun, skipPublish, skipBrew bool) []string {
	releaseArgs := []string{"release", "--clean"}
	if dryRun {
		releaseArgs = append(releaseArgs, "--snapshot", "--skip=publish")
	} else if skipPublish {
		releaseArgs = append(releaseArgs, "--skip=publish")
	} else if skipBrew {
		releaseArgs = append(releaseArgs, "--skip=scoop,homebrew")
	}
	return releaseArgs
}

func ensureReleaseTokens() {
	if os.Getenv("GITHUB_TOKEN") == "" {
		out, err := exec.Command("gh", "auth", "token").Output()
		if err == nil && len(out) > 0 {
			token := strings.TrimSpace(string(out))
			os.Setenv("GITHUB_TOKEN", token)
			cli.Info("Using GitHub token from gh CLI")
		}
	}
	if os.Getenv("HOMEBREW_TAP_GITHUB_TOKEN") == "" {
		if t := os.Getenv("GITHUB_TOKEN"); t != "" {
			os.Setenv("HOMEBREW_TAP_GITHUB_TOKEN", t)
		}
	}
}

func currentTag() string {
	out, err := exec.Command("git", "describe", "--tags", "--exact-match").Output()
	if err != nil {
		return "snapshot"
	}
	return strings.TrimSpace(string(out))
}
