package main

import (
	"fmt"
	"os/exec"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/deploy"
)

// quickstartTargets are the short-alias deploy targets that trigger
// preflight (auth check, framework detect, config generation).
// Anything not in this set passes through unchanged.
var quickstartTargets = map[string]bool{
	"vercel":     true,
	"cloudflare": true,
	"fly":        true,
}

// quickstartPreflight runs before deploy.Deploy for short aliases.
// Returns the resolved deploy.Target (possibly different from the
// short alias — e.g. "cloudflare" → cloudflare-pages or workers),
// any environment overrides the deploy driver needs, and a fatal
// error if preflight cannot proceed.
//
// Preflight intentionally never auto-runs an interactive `login`
// command — instead it prints the exact command the user should
// run, then bails. Spawning an interactive auth flow inside the
// deploy spinner has historically been a source of zombie
// processes and confused users.
func quickstartPreflight(alias, dir string) (deploy.Target, map[string]string, error) {
	switch alias {
	case "vercel":
		return preflightVercel(dir)
	case "cloudflare":
		return preflightCloudflare(dir)
	case "fly":
		return preflightFly(dir)
	default:
		return "", nil, fmt.Errorf("not a quickstart alias: %s", alias)
	}
}

// hasCLI reports whether `name` is on PATH.
func hasCLI(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

// curbDeploySuccess prints the Curb-voice success message for
// quickstart targets. Falls back to the generic success for any
// other target. Caller is responsible for actually emitting via
// cli.Success — this returns the line.
func curbDeploySuccess(alias, url string) string {
	if url == "" {
		url = "(no URL emitted — check provider dashboard)"
	}
	switch alias {
	case "vercel":
		return fmt.Sprintf("So that's it. That's the deploy. → %s", cli.Blue(url))
	case "cloudflare":
		return fmt.Sprintf("Live on Cloudflare. Edge. Free. Done. → %s", cli.Blue(url))
	case "fly":
		return fmt.Sprintf("Up on Fly. Closer to the user than your laptop. → %s", cli.Blue(url))
	default:
		return fmt.Sprintf("Live at %s", cli.Blue(url))
	}
}
