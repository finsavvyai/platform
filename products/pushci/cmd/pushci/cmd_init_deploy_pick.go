package main

import (
	"os"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

func genericPlatform(p string) bool {
	switch p {
	case "docker", "docker-compose", "script", "make":
		return true
	}
	return false
}

func pickDeployTargets(targets []detect.DeployTarget) []config.DeployTarget {
	if len(targets) == 0 {
		if isNonInteractive(os.Args[2:]) {
			return nil
		}
		return askDeployTarget()
	}
	if len(targets) == 1 {
		return toConfigTargets(targets)
	}

	selected := make([]bool, len(targets))
	anyNonGeneric := false
	for i, t := range targets {
		selected[i] = !genericPlatform(t.Platform)
		if selected[i] {
			anyNonGeneric = true
		}
	}
	// Telia/Nokia bug: when EVERY detected target is generic
	// (docker/script/make), the user has no cloud-platform signal
	// but clearly does deploy — they have a Dockerfile, deploy.sh,
	// or Makefile. Without this fallback, non-interactive init drops
	// all three and emits pushci.yml with no deploy: block.
	// Top target from ScanDeployTargets is already evidence-ranked.
	if !anyNonGeneric && len(targets) > 0 {
		selected[0] = true
	}

	// Non-interactive: accept the evidence-weighted defaults
	// (all non-generic platforms pre-selected, or top-ranked
	// generic when nothing cloud-specific was detected). No stdin.
	if isNonInteractive(os.Args[2:]) {
		return collectPicked(targets, selected)
	}
	return interactivePicker(targets, selected)
}

// collectPicked returns config.DeployTarget entries for every
// target whose selected[i] is true. Empty result returns nil so the
// caller can distinguish "user picked nothing" from a real selection.
func collectPicked(targets []detect.DeployTarget, selected []bool) []config.DeployTarget {
	var picked []detect.DeployTarget
	for i, t := range targets {
		if selected[i] {
			picked = append(picked, t)
		}
	}
	if len(picked) == 0 {
		return nil
	}
	return toConfigTargets(picked)
}

func toConfigTargets(targets []detect.DeployTarget) []config.DeployTarget {
	out := make([]config.DeployTarget, len(targets))
	for i, t := range targets {
		out[i] = config.DeployTarget{
			Name: t.Platform, Trigger: "push",
			OnlyOn: []string{"main", "master"}, Run: t.Command,
		}
	}
	return out
}
