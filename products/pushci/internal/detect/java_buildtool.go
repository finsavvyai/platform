package detect

import "path/filepath"

// JavaTool names the build system used by a Java/Kotlin project.
// Maven and Gradle can coexist (rare but not unheard of in migration
// branches); ToolMixed signals that case so callers can warn.
type JavaTool string

const (
	JavaToolMaven   JavaTool = "maven"
	JavaToolGradle  JavaTool = "gradle"
	JavaToolMixed   JavaTool = "mixed"
	JavaToolUnknown JavaTool = "unknown"
)

// javaGradleSignals lists file names that, when present, mean this
// directory is driven by Gradle. build.gradle{,.kts} is the primary
// evidence; settings.gradle{,.kts} and gradlew are strong corroboration
// for multi-project and wrapper-using repos respectively.
var javaGradleSignals = []string{
	"build.gradle",
	"build.gradle.kts",
	"settings.gradle",
	"settings.gradle.kts",
	"gradlew",
	"gradle.properties",
}

// DetectJavaBuildTool inspects a directory and classifies its build
// system. The detector is lockfile/build-file driven, matching the
// pattern DetectNodeBuildTool established for Node projects — the
// marker table alone is not enough to disambiguate a Gradle repo from
// a Maven repo when both kinds of signals might show up in parent
// or sibling directories.
//
// Priority:
//
//	pom.xml + any gradle signal  → ToolMixed  (prefer Maven, warn)
//	pom.xml only                 → ToolMaven
//	any gradle signal            → ToolGradle
//	nothing                      → ToolUnknown
func DetectJavaBuildTool(dir string) JavaTool {
	hasMaven := fileExists(filepath.Join(dir, "pom.xml"))
	hasGradle := false
	for _, name := range javaGradleSignals {
		if fileExists(filepath.Join(dir, name)) {
			hasGradle = true
			break
		}
	}
	switch {
	case hasMaven && hasGradle:
		return JavaToolMixed
	case hasMaven:
		return JavaToolMaven
	case hasGradle:
		return JavaToolGradle
	}
	return JavaToolUnknown
}

// JavaBuildToolToBuildTool maps the richer JavaTool enum to the
// project-wide BuildTool value stored on detect.Project. Mixed
// collapses to Maven because that's what the stage generator will
// actually run (Maven wins the tie with a warning).
func JavaBuildToolToBuildTool(t JavaTool) BuildTool {
	switch t {
	case JavaToolGradle:
		return ToolGradle
	case JavaToolMaven, JavaToolMixed:
		return ToolMaven
	}
	return ""
}

// HasGradleWrapper reports whether the directory ships its own
// ./gradlew script. When true, stage commands should invoke
// `./gradlew` instead of the ambient `gradle` binary so CI runs
// reproduce what developers see locally.
func HasGradleWrapper(dir string) bool {
	return fileExists(filepath.Join(dir, "gradlew"))
}
