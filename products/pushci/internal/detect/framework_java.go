// Package detect — Java/Kotlin framework sub-detectors.
//
// Holds strong-signal Spring Boot detection so framework_ext.go does
// not grow past the 100-line cap. A pom.xml or build.gradle is only
// classified as Spring Boot when at least ONE strong signal is found.
// Loose substring matches on "spring-boot" (e.g. a single
// spring-boot-starter-jetty dependency in a non-Boot project) must
// NOT qualify.

package detect

import (
	"os"
	"path/filepath"
	"regexp"
)

// Strong signals, in priority order:
//  1. <parent> block with groupId=org.springframework.boot
//  2. <artifactId>spring-boot-maven-plugin</artifactId>
//  3. Gradle `id 'org.springframework.boot'` / `id("...")` plugin
var (
	reSpringBootParent = regexp.MustCompile(
		`(?s)<parent>\s*(?:<[^/>]+>[^<]*</[^>]+>\s*)*` +
			`<groupId>\s*org\.springframework\.boot\s*</groupId>`)
	reSpringBootPlugin = regexp.MustCompile(
		`<artifactId>\s*spring-boot-maven-plugin\s*</artifactId>`)
	reSpringBootGradle = regexp.MustCompile(
		`id\s*\(?\s*["']org\.springframework\.boot["']`)
)

// isSpringBootPom reports whether a pom.xml contains at least one
// strong Spring Boot signal. A single <dependency> on an
// org.springframework.boot artifact is intentionally NOT sufficient.
func isSpringBootPom(data []byte) bool {
	return reSpringBootParent.Match(data) || reSpringBootPlugin.Match(data)
}

// isSpringBootGradle reports whether a build.gradle[.kts] applies
// the Spring Boot plugin via `id(...)`.
func isSpringBootGradle(data []byte) bool {
	return reSpringBootGradle.Match(data)
}

// detectSpringBoot walks pom.xml and build.gradle[.kts] in `base`
// and returns true if any carries a strong signal.
func detectSpringBoot(base string) bool {
	if data, err := os.ReadFile(filepath.Join(base, "pom.xml")); err == nil {
		if isSpringBootPom(data) {
			return true
		}
	}
	for _, name := range []string{"build.gradle", "build.gradle.kts"} {
		data, err := os.ReadFile(filepath.Join(base, name))
		if err != nil {
			continue
		}
		if isSpringBootGradle(data) {
			return true
		}
	}
	return false
}

// javaBuildFiles returns which of the supported build files are
// present in `base`.
func javaBuildFiles(base string) []string {
	var out []string
	for _, f := range []string{"pom.xml", "build.gradle", "build.gradle.kts"} {
		if fileExists(filepath.Join(base, f)) {
			out = append(out, f)
		}
	}
	return out
}

// detectJavaFrameworkFromBuildFiles classifies non-SpringBoot Java
// frameworks via cheap substring scans. Keeps the old behaviour for
// frameworks that still use loose matching — Spring Boot is the only
// one we promote to strong-signal detection right now.
func detectJavaFrameworkFromBuildFiles(base string) string {
	for _, name := range javaBuildFiles(base) {
		p := filepath.Join(base, name)
		switch {
		case fileContains(p, "quarkus"):
			return "quarkus"
		case fileContains(p, "micronaut"):
			return "micronaut"
		case fileContains(p, "com.android"):
			return "android"
		case fileContains(p, "kotlin"):
			return "kotlin"
		}
	}
	return ""
}
