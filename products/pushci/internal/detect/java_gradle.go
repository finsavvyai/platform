// Package detect — Java/Kotlin Gradle enriched parsing.
//
// Mirrors java_maven.go. Regex-based scanning across both Groovy DSL
// and Kotlin DSL build files. Stdlib only — no external parser.

package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// GradleBuild is the parsed subset of a build.gradle[.kts] we care
// about for pipeline generation.
type GradleBuild struct {
	Group       string
	Version     string
	IsKotlinDsl bool
	Plugins     []string
	JavaVersion string
	Subprojects []string
}

var (
	gradleFilenames   = []string{"build.gradle.kts", "build.gradle"}
	settingsFilenames = []string{"settings.gradle.kts", "settings.gradle"}
)

// ParseGradleFile reads and parses a build.gradle[.kts] from disk.
// When a sibling settings.gradle[.kts] is present, its include()
// calls are parsed as subprojects so IsMultiProject works without
// an additional call.
func ParseGradleFile(path string) (*GradleBuild, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	b := parseGradleContent(string(data))
	b.IsKotlinDsl = strings.HasSuffix(path, ".kts") || b.IsKotlinDsl
	b.Subprojects = loadGradleSubprojects(filepath.Dir(path))
	return b, nil
}

func loadGradleSubprojects(dir string) []string {
	for _, name := range settingsFilenames {
		p := filepath.Join(dir, name)
		if !fileExists(p) {
			continue
		}
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		return parseSettingsInclude(string(data))
	}
	return nil
}

// IsMultiProject reports whether the build declares submodules via
// its settings.gradle[.kts] include() list.
func (b *GradleBuild) IsMultiProject() bool {
	return b != nil && len(b.Subprojects) > 0
}

// DetectGradleProject — given a directory, if it contains a
// build.gradle[.kts] return a parsed representation. Returns
// (nil, nil) when no gradle file is present, mirroring
// DetectMavenProject.
func DetectGradleProject(dir string) (*GradleBuild, error) {
	for _, name := range gradleFilenames {
		path := filepath.Join(dir, name)
		if !fileExists(path) {
			continue
		}
		return ParseGradleFile(path)
	}
	return nil, nil
}
