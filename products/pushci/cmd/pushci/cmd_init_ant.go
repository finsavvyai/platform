package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/migrate"
)

// tryAntMigrate looks for an Apache Ant build.xml in root and
// returns a config.Pipeline derived from the declared targets.
// Returns nil when no Ant file is present or the build.xml has no
// parseable targets — callers fall back to the framework-heuristic
// path or the downstream WAR / shell-only fallbacks.
//
// Prefers a root-level build.xml. Subdirectory build.xml files are
// picked up only when root is not a direct Ant project — mirrors
// the buildspec precedence logic.
//
// When a root-level pom.xml exists alongside build.xml, Maven wins.
// We warn and return nil so the framework heuristic picks up Maven
// stages — hybrid Maven+Ant repos (legacy deploy/dist Ant targets)
// want Maven as the primary build tool. See telia NinjaCore /
// NinjaDKMDWCInterface dogfood (v1.6.3).
func tryAntMigrate(root string) *config.Pipeline {
	providers := detect.ScanCIProviders(root)
	rel := pickAntConfigFile(providers)
	if rel == "" {
		return nil
	}
	if hasRootPom(root) {
		cli.Warn("pom.xml detected at root alongside " + rel + " — using Maven as primary build tool. To also run Ant targets, add them manually to pushci.yml.")
		return nil
	}
	full := filepath.Join(root, rel)
	data, err := os.ReadFile(full)
	if err != nil {
		cli.Warn("Found " + rel + " but could not read: " + err.Error())
		return nil
	}
	cli.Info("Found Apache Ant build file at " + cli.Bold(rel))
	r := migrate.ConvertAnt(string(data), rel)
	if r.StagesConverted == 0 {
		for _, w := range r.Warnings {
			cli.Warn(w)
		}
		cli.Warn("build.xml had no importable targets — falling back to framework detection")
		return nil
	}
	for _, w := range r.Warnings {
		cli.Warn(w)
	}
	cli.Success(fmt.Sprintf("Imported %d stages, %d commands from %s", r.StagesConverted, r.StepsConverted, rel))
	pipe := parseAntPipeline(r.PushCIYAML, rel)
	if pipe == nil {
		return nil
	}
	attachAntDeploys(pipe, r.Deploys)
	return pipe
}

// hasRootPom reports whether a Maven pom.xml lives at root. Used by
// tryAntMigrate to yield priority to Maven in hybrid repos.
func hasRootPom(root string) bool {
	info, err := os.Stat(filepath.Join(root, "pom.xml"))
	return err == nil && !info.IsDir()
}

// pickAntConfigFile returns the best ci:ant ConfigFile from providers,
// preferring root-level build.xml over subdirectory copies.
func pickAntConfigFile(providers []detect.CIProvider) string {
	for _, p := range providers {
		if p.Marker == "ci:ant" && p.ConfigFile == "build.xml" {
			return p.ConfigFile
		}
	}
	for _, p := range providers {
		if p.Marker == "ci:ant" {
			return p.ConfigFile
		}
	}
	return ""
}

// parseAntPipeline and antHeaderLines live in cmd_init_ant_helpers.go.
