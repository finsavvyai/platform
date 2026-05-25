package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/integrations/bitbucket"
	"github.com/finsavvyai/pipewarden/internal/integrations/github"
	"github.com/finsavvyai/pipewarden/internal/integrations/gitlab"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// handleTestProviderSubcommand connects to a real CI provider and runs the
// full read path: TestConnection -> ListPipelines -> ListPipelineRuns. Useful
// for end-to-end smoke testing before wiring a connection through the
// dashboard.
//
// Usage:
//
//	pipewarden test-provider --platform=github --owner=foo --repo=bar [--token=...] [--base-url=...]
//	pipewarden test-provider --platform=gitlab --owner=foo --repo=bar [--token=...] [--base-url=https://gitlab.com]
//	pipewarden test-provider --platform=bitbucket --owner=foo --repo=bar --username=u --token=app-pwd
func handleTestProviderSubcommand(args []string) {
	os.Exit(testProviderSubcommand(args))
}

// testProviderSubcommand is the testable form. Returns the exit code that
// handleTestProviderSubcommand would pass to os.Exit.
func testProviderSubcommand(args []string) int {
	fs := flag.NewFlagSet("test-provider", flag.ContinueOnError)
	platform := fs.String("platform", "", "github | gitlab | bitbucket")
	owner := fs.String("owner", "", "owner / namespace / workspace")
	repo := fs.String("repo", "", "repository / project name")
	token := fs.String("token", "", "API token (env: GITHUB_TOKEN, GITLAB_TOKEN, BITBUCKET_APP_PASSWORD)")
	username := fs.String("username", "", "Bitbucket username (Bitbucket only)")
	baseURL := fs.String("base-url", "", "API base URL override (defaults per platform)")
	limit := fs.Int("limit", 5, "max pipeline runs to list")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *platform == "" || *owner == "" || *repo == "" {
		fmt.Fprintln(os.Stderr, "usage: pipewarden test-provider --platform=<github|gitlab|bitbucket> --owner=<x> --repo=<y> [--token=...]")
		return 2
	}

	if *token == "" {
		switch *platform {
		case "github":
			*token = os.Getenv("GITHUB_TOKEN")
		case "gitlab":
			*token = os.Getenv("GITLAB_TOKEN")
		case "bitbucket":
			*token = os.Getenv("BITBUCKET_APP_PASSWORD")
		}
	}

	logger, _ := logging.New(&config.LoggingConfig{Level: "warn", JSON: false})
	provider, err := buildTestProvider(*platform, *token, *username, *baseURL, logger)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return runProviderSmoke(ctx, provider, *owner, *repo, *limit)
}

// hasToken returns true when a meaningful credential is present on the
// underlying provider — used by the smoke command to decide whether the
// authenticated TestConnection call makes sense.
func hasToken(p integrations.Provider) bool {
	type tokened interface{ HasToken() bool }
	if t, ok := p.(tokened); ok {
		return t.HasToken()
	}
	return true // assume yes if we can't tell — TestConnection will fail loudly
}

func buildTestProvider(platform, token, username, baseURL string, logger *logging.Logger) (integrations.Provider, error) {
	switch platform {
	case "github":
		cfg := github.Config{Token: token, BaseURL: baseURL}
		return github.NewClient(cfg, logger), nil
	case "gitlab":
		cfg := gitlab.Config{Token: token, BaseURL: baseURL}
		// Empty BaseURL → NewClient defaults to https://gitlab.com/api/v4.
		return gitlab.NewClient(cfg, logger), nil
	case "bitbucket":
		if username == "" {
			return nil, fmt.Errorf("bitbucket requires --username")
		}
		cfg := bitbucket.Config{Username: username, AppPassword: token, BaseURL: baseURL}
		return bitbucket.NewClient(cfg, logger), nil
	default:
		return nil, fmt.Errorf("unsupported platform %q", platform)
	}
}

// runProviderSmoke runs the read-path smoke (TestConnection, ListPipelines,
// ListPipelineRuns) and returns 0 on success, 1 on the first failure.
func runProviderSmoke(ctx context.Context, provider integrations.Provider, owner, repo string, limit int) int {
	if hasToken(provider) {
		fmt.Printf("→ TestConnection (%s)\n", provider.Name())
		status, err := provider.TestConnection(ctx)
		if err != nil {
			fmt.Printf("  ✗ %v\n", err)
			return 1
		}
		connSym := "✗"
		if status.Connected {
			connSym = "✓"
		}
		fmt.Printf("  %s connected=%v user=%q latency=%s scopes=%v\n",
			connSym, status.Connected, status.User, status.Latency, status.Scopes)
		if !status.Connected {
			fmt.Printf("  message: %s\n", status.Message)
			return 1
		}
	} else {
		fmt.Printf("→ TestConnection skipped (no token; using public-read mode)\n")
	}

	fmt.Printf("→ ListPipelines(%s/%s)\n", owner, repo)
	pipelines, err := provider.ListPipelines(ctx, owner, repo)
	if err != nil {
		fmt.Printf("  ✗ %v\n", err)
		return 1
	}
	fmt.Printf("  ✓ %d pipelines\n", len(pipelines))
	for i, p := range pipelines {
		if i >= 5 {
			fmt.Printf("  …and %d more\n", len(pipelines)-5)
			break
		}
		fmt.Printf("    - %s id=%s status=%s\n", p.Name, p.ID, p.Status)
	}

	fmt.Printf("→ ListPipelineRuns(%s/%s, limit=%d)\n", owner, repo, limit)
	runs, err := provider.ListPipelineRuns(ctx, owner, repo, limit)
	if err != nil {
		fmt.Printf("  ✗ %v\n", err)
		return 1
	}
	fmt.Printf("  ✓ %d runs\n", len(runs))
	for _, r := range runs {
		fmt.Printf("    - %s status=%s branch=%s started=%s\n",
			r.ID, r.Status, r.Branch, r.StartedAt.Format(time.RFC3339))
	}

	fmt.Println("\n✓ provider smoke test passed end-to-end")
	return 0
}
