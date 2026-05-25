package main

import (
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/detect"
)

// buildInstallCommandsForProjects returns install commands that honour
// project-level build-tool choices. The legacy buildInstallCommands
// keyed everything off the stacks map, which meant a Gradle-only
// Java project still emitted `mvn dependency:resolve -q` because
// `stacks[Java]` was true.
//
// The telia v1.6.1 dogfood report caught this: NinjaSplitFile and
// NinjaEmbeddedSIM are Gradle-only, had no pom.xml, and every CI run
// failed instantly on a Maven command that could never succeed. Now
// callers that already know which projects are in scope get the
// correct install command per project.
func buildInstallCommandsForProjects(root string, stacks map[detect.Stack]bool, projects []detect.Project) []string {
	needsJava := stacks[detect.Java]
	needsClojure := stacks[detect.Clojure]
	if !needsJava && !needsClojure {
		return buildInstallCommands(stacks)
	}
	// Drop stacks that have per-project install logic below; the
	// generic buildInstallCommands would emit static fallbacks (like
	// `lein deps` for every Clojure repo) that contradict what
	// DetectClojure actually picked for each project.
	filtered := map[detect.Stack]bool{}
	for s, v := range stacks {
		if s == detect.Java || s == detect.Clojure {
			continue
		}
		filtered[s] = v
	}
	cmds := buildInstallCommands(filtered)
	if needsJava {
		cmds = append(cmds, javaInstallCmdsFromProjects(root, projects)...)
	}
	if needsClojure {
		cmds = append(cmds, clojureInstallCmds(root, projects)...)
	}
	return cmds
}

// javaInstallCmdsFromProjects picks install commands based on the
// actual build tool detected on disk for each Java project, dropping
// duplicates. Gradle projects never emit `mvn` commands.
func javaInstallCmdsFromProjects(root string, projects []detect.Project) []string {
	seen := map[string]bool{}
	var cmds []string
	for _, p := range projects {
		if p.Stack != detect.Java {
			continue
		}
		cmd := javaInstallCmdForProject(root, p)
		if cmd == "" || seen[cmd] {
			continue
		}
		seen[cmd] = true
		cmds = append(cmds, cmd)
	}
	return cmds
}

// javaInstallCmdForProject inspects the project's directory and
// returns the canonical install/warm-cache command:
//
//	Gradle: ./gradlew dependencies --quiet (when wrapper present)
//	        gradle dependencies --quiet    (when no wrapper)
//	Maven:  mvn dependency:resolve -q
//	Mixed:  Maven wins (warn upstream)
//
// Fallback when the directory does not resolve: Maven, to preserve
// pre-v1.6.2 behaviour for odd edge cases.
func javaInstallCmdForProject(root string, p detect.Project) string {
	dir := filepath.Join(root, p.Dir)
	switch detect.DetectJavaBuildTool(dir) {
	case detect.JavaToolGradle:
		if detect.HasGradleWrapper(dir) {
			return "./gradlew dependencies --quiet"
		}
		return "gradle dependencies --quiet"
	case detect.JavaToolMixed, detect.JavaToolMaven:
		return "mvn dependency:resolve -q"
	}
	if p.BuildTool == detect.ToolGradle {
		return "./gradlew dependencies --quiet"
	}
	return "mvn dependency:resolve -q"
}
