package migrate

import "regexp"

// antTargetRE matches `<target name="X"` declarations in an Ant
// build.xml. Regex-only parsing is intentional — the task description
// forbids pulling in an XML parser, and Ant build files are
// consistently hand-written so a single regex covers >99% of real
// files. Quotes may be single or double.
var antTargetRE = regexp.MustCompile(`(?i)<target\s+[^>]*name\s*=\s*["']([^"']+)["']`)

// antDefaultRE matches the project-level `default="X"` attribute
// that determines what `ant` (no target) runs. Captured to label the
// generated pushci stage accurately ("ant compile" vs "ant").
var antDefaultRE = regexp.MustCompile(`(?i)<project\b[^>]*\bdefault\s*=\s*["']([^"']+)["']`)

// ExtractAntTargets is the exported alias for extractAntTargets so
// the `pushci init` flow can re-parse the build.xml for header
// bookkeeping without importing this package's internals.
func ExtractAntTargets(raw string) []string { return extractAntTargets(raw) }

// extractAntTargets returns the target names declared in raw in
// source order. Duplicates are dropped (Ant allows target overrides
// via import but the first wins for our purposes). Callers use this
// to pick the first build-like target (dist/jar/war/package) for the
// final build stage.
func extractAntTargets(raw string) []string {
	matches := antTargetRE.FindAllStringSubmatch(raw, -1)
	seen := map[string]bool{}
	var out []string
	for _, m := range matches {
		if len(m) < 2 {
			continue
		}
		name := m[1]
		if seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, name)
	}
	return out
}

// extractAntDefault returns the project/@default target name, or "".
func extractAntDefault(raw string) string {
	m := antDefaultRE.FindStringSubmatch(raw)
	if len(m) < 2 {
		return ""
	}
	return m[1]
}

// pickAntBuildTarget returns the first target in names that looks
// like a final-artifact build step (dist, jar, war, package, build,
// assemble). Empty string when none match — caller falls back to the
// default target or skips the build stage.
func pickAntBuildTarget(names []string) string {
	priority := []string{"dist", "jar", "war", "package", "build", "assemble"}
	for _, p := range priority {
		for _, n := range names {
			if n == p {
				return n
			}
		}
	}
	return ""
}
