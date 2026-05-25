package detect

import (
	"path/filepath"
)

// Scan walks a repo root and returns all detected projects. Node
// workspaces collapse to a single root project (opensyber dogfood).
// Sibling scanners: ScanDeployTargets, ScanCIProviders.
func Scan(root string) []Project {
	var projects []Project
	seen := map[string]bool{}
	workspace := DetectWorkspace(root)

	for _, m := range markers {
		for _, match := range findFiles(root, m.file, 3) {
			dir := filepath.Dir(match)
			rel, _ := filepath.Rel(root, dir)
			if rel == "" {
				rel = "."
			}
			if m.stack == Node && workspace.IsWorkspace && rel != "." {
				continue
			}
			key := string(m.stack) + ":" + rel
			if seen[key] {
				continue
			}
			if skipMarker(m, dir) {
				seen[key] = true
				continue
			}
			seen[key] = true
			projects = append(projects, newProject(root, rel, dir, m))
		}
	}
	return projects
}

// skipMarker returns true when a marker should be suppressed for dir.
// Two cases:
//   - Maven aggregator poms — reactors, not real projects; the
//     reactor's `mvn verify` already builds every child module.
//   - Cpp on a dir that carries a Clojure signal — the Makefile is an
//     orchestrator calling `clojure -M:test`, not a C/C++ build.
func skipMarker(m struct {
	file  string
	stack Stack
	tool  BuildTool
}, dir string) bool {
	if m.stack == Java && m.tool == ToolMaven && IsMavenAggregator(dir) {
		return true
	}
	if m.stack == Cpp && HasClojureSignal(dir) {
		return true
	}
	return false
}

// newProject constructs a Project with the right BuildTool. Marker
// tables store a best-guess default; per-stack helpers re-resolve the
// actual tool from files on disk.
func newProject(root, rel, dir string, m struct {
	file  string
	stack Stack
	tool  BuildTool
}) Project {
	p := Project{Stack: m.stack, BuildTool: m.tool, Dir: rel}
	switch m.stack {
	case Node:
		p.BuildTool = DetectNodeBuildTool(dir, root)
	case Java:
		if jt := DetectJavaBuildTool(dir); jt != JavaToolUnknown {
			if bt := JavaBuildToolToBuildTool(jt); bt != "" {
				p.BuildTool = bt
			}
		}
	case Clojure:
		if ct := DetectClojure(dir); ct != "" {
			p.BuildTool = ct
		}
	}
	p.Framework = detectFramework(root, rel, m.stack)
	return p
}
