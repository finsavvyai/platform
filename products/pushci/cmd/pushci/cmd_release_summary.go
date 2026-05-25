package main

import (
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
)

func printReleaseSummary(tag string, duration time.Duration, dryRun bool) {
	fmt.Println()

	if dryRun {
		cli.Header("Dry Run Complete")
	} else {
		cli.Header("Release Complete")
	}

	cli.Info(fmt.Sprintf("Tag:      %s", cli.Bold(tag)))
	cli.Info(fmt.Sprintf("Duration: %s", duration.Round(time.Second)))

	if !dryRun {
		printPublishTargets(tag)
	}

	printCostSavings(duration)
}

func printPublishTargets(tag string) {
	cli.Info("Published:")
	cli.Info(fmt.Sprintf("  %s GitHub Release", cli.CheckMark()))
	cli.Info(fmt.Sprintf("  %s Homebrew tap", cli.CheckMark()))
	cli.Info(fmt.Sprintf("  %s Binary archives (linux/darwin/windows)", cli.CheckMark()))

	repo := repoSlugFromRemote()
	if repo != "" {
		url := fmt.Sprintf("https://github.com/%s/releases/tag/%s", repo, tag)
		cli.Info(fmt.Sprintf("\nRelease: %s", cli.Blue(url)))
	}
}

func printCostSavings(duration time.Duration) {
	fmt.Println()
	mins := duration.Minutes()
	ghaCost := mins * 0.008 * 6
	if ghaCost < 0.50 {
		ghaCost = 0.50
	}

	cli.Info("Cost comparison:")
	cli.Info(fmt.Sprintf("  GitHub Actions (6 matrix builds): ~$%.2f", ghaCost))
	cli.Info(fmt.Sprintf("  PushCI (local):                   %s", cli.Green("$0.00")))
	cli.Info(fmt.Sprintf("  Saved: %s", cli.Bold(cli.Green(fmt.Sprintf("$%.2f", ghaCost)))))
}

func repoSlugFromRemote() string {
	out, err := exec.Command("git", "remote", "get-url", "origin").Output()
	if err != nil {
		return ""
	}
	remote := strings.TrimSpace(string(out))
	remote = strings.TrimSuffix(remote, ".git")
	if i := strings.Index(remote, "github.com"); i >= 0 {
		return strings.TrimLeft(remote[i+len("github.com"):], "/:")
	}
	return ""
}
