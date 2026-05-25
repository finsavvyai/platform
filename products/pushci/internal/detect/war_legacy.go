package detect

import (
	"os"
	"path/filepath"
)

// warLegacyMaxDepth caps how far ScanLegacyWAR walks. The
// `WEB-INF/web.xml` descriptor usually sits at `web/WEB-INF/web.xml`
// or `src/main/webapp/WEB-INF/web.xml`. Depth 4 covers both plus the
// occasional monorepo-per-service variant (telia v1.6.1
// NinjaGenericAPI).
const warLegacyMaxDepth = 4

// ScanLegacyWAR detects a legacy Servlet WAR project — a repo with
// a `WEB-INF/web.xml` descriptor but no recognized build tool
// (pom.xml, build.gradle, build.xml) at root. Returns a single
// CIProvider with marker `project:java-war-legacy` when detected,
// nil otherwise.
//
// Unlike ci:* markers that signal a migrateable foreign CI format,
// the `project:` prefix signals a raw project shape that needs a
// user-authored build script. pushci init emits a placeholder YAML
// with a commented template instead of guessing javac flags.
func ScanLegacyWAR(root string) *CIProvider {
	if rootHasBuildDescriptor(root) {
		return nil
	}
	matches := findFiles(root, "web.xml", warLegacyMaxDepth)
	for _, m := range matches {
		if !isWebInfDescriptor(root, m) {
			continue
		}
		rel, err := filepath.Rel(root, m)
		if err != nil {
			continue
		}
		return &CIProvider{
			Marker:     "project:java-war-legacy",
			ConfigFile: filepath.ToSlash(rel),
		}
	}
	return nil
}

// HasLegacyWAR reports whether root is a legacy Servlet WAR project.
func HasLegacyWAR(root string) bool { return ScanLegacyWAR(root) != nil }

// rootHasBuildDescriptor reports whether any standard Java build
// descriptor sits at the repo root. Used to rule out a WAR-legacy
// classification when Maven/Gradle/Ant already owns the build.
func rootHasBuildDescriptor(root string) bool {
	for _, name := range []string{"pom.xml", "build.gradle", "build.gradle.kts", "build.xml"} {
		if _, err := os.Stat(filepath.Join(root, name)); err == nil {
			return true
		}
	}
	return false
}

// isWebInfDescriptor returns true when path points at a file named
// `web.xml` whose parent directory is named `WEB-INF` (the Servlet
// spec location). Guards against unrelated `web.xml` files in
// documentation or vendored copies.
func isWebInfDescriptor(root, path string) bool {
	parent := filepath.Base(filepath.Dir(path))
	return parent == "WEB-INF"
}
