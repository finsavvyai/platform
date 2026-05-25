package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/deploy"
)

// preflightCloudflare disambiguates `pushci deploy cloudflare`
// into either cloudflare-pages or cloudflare-workers based on
// repo signals:
//   - wrangler.toml present → Workers
//   - dist/ + index.html (static SPA) → Pages
//   - default → Pages (most common SPA case)
func preflightCloudflare(dir string) (deploy.Target, map[string]string, error) {
	if !hasCLI("npx") && !hasCLI("wrangler") {
		return "", nil, fmt.Errorf("need `npx` (Node.js) or `wrangler` on PATH — install Node 20+, then re-run")
	}
	target := pickCloudflareTarget(dir)
	if target == deploy.TargetCloudflareWorkers {
		cli.Info("Detected wrangler.toml → deploying to Cloudflare Workers")
	} else {
		cli.Info("No wrangler.toml found → deploying to Cloudflare Pages (static)")
	}
	if !cloudflareLikelyAuthed() {
		fmt.Fprintln(os.Stderr,
			"  hint: not authenticated yet — run `npx wrangler login` once, then re-run")
	}
	env := map[string]string{}
	if target == deploy.TargetCloudflarePages && os.Getenv("CF_PROJECT") == "" {
		env["CF_PROJECT"] = filepath.Base(dir)
	}
	return target, env, nil
}

// pickCloudflareTarget reads filesystem signals to decide between
// Workers and Pages. Pure function for testability — no I/O beyond
// stat.
func pickCloudflareTarget(dir string) deploy.Target {
	if fileExists(filepath.Join(dir, "wrangler.toml")) {
		return deploy.TargetCloudflareWorkers
	}
	if fileExists(filepath.Join(dir, "wrangler.jsonc")) {
		return deploy.TargetCloudflareWorkers
	}
	if dirExists(filepath.Join(dir, "dist")) && fileExists(filepath.Join(dir, "dist", "index.html")) {
		return deploy.TargetCloudflarePages
	}
	if dirExists(filepath.Join(dir, "build")) && fileExists(filepath.Join(dir, "build", "index.html")) {
		return deploy.TargetCloudflarePages
	}
	return deploy.TargetCloudflarePages
}

// cloudflareLikelyAuthed returns true when wrangler's auth file
// is present in the standard location. False is a hint, not a
// proof — we don't block, we just suggest.
func cloudflareLikelyAuthed() bool {
	home, err := os.UserHomeDir()
	if err != nil {
		return false
	}
	for _, rel := range []string{
		".wrangler/config/default.toml",
		"Library/Preferences/.wrangler/config/default.toml",
	} {
		if fileExists(filepath.Join(home, rel)) {
			return true
		}
	}
	return os.Getenv("CLOUDFLARE_API_TOKEN") != ""
}

func fileExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && !info.IsDir()
}

func dirExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && info.IsDir()
}
