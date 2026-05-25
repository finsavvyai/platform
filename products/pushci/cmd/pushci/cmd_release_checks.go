package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
)

func checkReleasePrereqs(root string) error {
	if err := checkGitClean(); err != nil {
		return err
	}
	if err := checkTagExists(); err != nil {
		return err
	}
	if err := checkGoreleaserInstalled(); err != nil {
		return err
	}
	if err := checkGitHubToken(); err != nil {
		return err
	}
	return checkGoreleaserConfig(root)
}

func checkGitClean() error {
	out, err := exec.Command("git", "status", "--porcelain").Output()
	if err != nil {
		return fmt.Errorf("not a git repository")
	}
	if len(strings.TrimSpace(string(out))) > 0 {
		return fmt.Errorf("working directory is not clean — commit or stash changes first")
	}
	cli.Info(cli.CheckMark() + " Git working directory is clean")
	return nil
}

func checkTagExists() error {
	_, err := exec.Command("git", "describe", "--tags", "--exact-match").Output()
	if err != nil {
		cli.Warn("Current commit is not tagged")
		cli.Info("Create a tag first: git tag -a v1.0.0 -m \"release v1.0.0\"")
		return fmt.Errorf("no tag on current commit — run: git tag -a <version> -m \"<message>\"")
	}
	tag := currentTag()
	cli.Info(fmt.Sprintf("%s Tag found: %s", cli.CheckMark(), cli.Bold(tag)))
	return nil
}

func checkGoreleaserInstalled() error {
	_, err := exec.LookPath("goreleaser")
	if err != nil {
		cli.Warn("goreleaser is not installed")
		cli.Info("Install with one of:")
		cli.Info("  brew install goreleaser")
		cli.Info("  go install github.com/goreleaser/goreleaser/v2@latest")
		return fmt.Errorf("goreleaser not found in PATH")
	}
	cli.Info(cli.CheckMark() + " goreleaser installed")
	return nil
}

func checkGitHubToken() error {
	if os.Getenv("GITHUB_TOKEN") != "" {
		cli.Info(cli.CheckMark() + " GITHUB_TOKEN set")
		return nil
	}
	_, err := exec.LookPath("gh")
	if err != nil {
		return fmt.Errorf("GITHUB_TOKEN not set and gh CLI not installed")
	}
	out, err := exec.Command("gh", "auth", "token").Output()
	if err != nil || len(strings.TrimSpace(string(out))) == 0 {
		return fmt.Errorf("GITHUB_TOKEN not set — run: gh auth login")
	}
	cli.Info(cli.CheckMark() + " GitHub token available via gh CLI")
	return nil
}

// checkGoreleaserConfig lives in cmd_release_config.go.
