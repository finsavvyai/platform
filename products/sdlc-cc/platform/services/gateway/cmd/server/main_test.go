package main

import (
	"testing"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/config"
)

func TestApplyBuildMetadataUsesInjectedValues(t *testing.T) {
	originalVersion := version
	originalBuildTime := buildTime
	originalGitCommit := gitCommit
	t.Cleanup(func() {
		version = originalVersion
		buildTime = originalBuildTime
		gitCommit = originalGitCommit
	})

	version = "2.4.1"
	buildTime = "2026-04-03T10:11:12Z"
	gitCommit = "abc123def"

	cfg := &config.Config{
		Version:   "1.0.0",
		BuildTime: "unknown",
		GitCommit: "unknown",
	}

	applyBuildMetadata(cfg)

	if cfg.Version != "2.4.1" {
		t.Fatalf("expected injected version, got %q", cfg.Version)
	}

	if cfg.BuildTime != "2026-04-03T10:11:12Z" {
		t.Fatalf("expected injected build time, got %q", cfg.BuildTime)
	}

	if cfg.GitCommit != "abc123def" {
		t.Fatalf("expected injected git commit, got %q", cfg.GitCommit)
	}
}

func TestApplyBuildMetadataPreservesConfigWhenUnset(t *testing.T) {
	originalVersion := version
	originalBuildTime := buildTime
	originalGitCommit := gitCommit
	t.Cleanup(func() {
		version = originalVersion
		buildTime = originalBuildTime
		gitCommit = originalGitCommit
	})

	version = "dev"
	buildTime = "unknown"
	gitCommit = "unknown"

	cfg := &config.Config{
		Version:   "1.0.0",
		BuildTime: "2026-04-01T00:00:00Z",
		GitCommit: "current",
	}

	applyBuildMetadata(cfg)

	if cfg.Version != "1.0.0" {
		t.Fatalf("expected config version to be preserved, got %q", cfg.Version)
	}

	if cfg.BuildTime != "2026-04-01T00:00:00Z" {
		t.Fatalf("expected config build time to be preserved, got %q", cfg.BuildTime)
	}

	if cfg.GitCommit != "current" {
		t.Fatalf("expected config git commit to be preserved, got %q", cfg.GitCommit)
	}
}
