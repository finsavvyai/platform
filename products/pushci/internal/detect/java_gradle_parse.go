package detect

import "strings"

// parseGradleContent walks a build-script body and extracts the
// fields we need. Exported for testability.
func parseGradleContent(src string) *GradleBuild {
	clean := stripGradleComments(src)
	b := &GradleBuild{
		IsKotlinDsl: looksLikeKotlinDsl(clean),
		Plugins:     extractGradlePlugins(clean),
		JavaVersion: extractGradleJavaVersion(clean),
	}
	if m := reGroupField.FindStringSubmatch(clean); len(m) == 2 {
		b.Group = strings.TrimSpace(m[1])
	}
	if m := reVersionField.FindStringSubmatch(clean); len(m) == 2 {
		b.Version = strings.TrimSpace(m[1])
	}
	return b
}

func stripGradleComments(src string) string {
	src = reBlockComment.ReplaceAllString(src, "")
	return reGroovyComment.ReplaceAllString(src, "")
}

func looksLikeKotlinDsl(src string) bool {
	if strings.Contains(src, "val ") && strings.Contains(src, " = ") {
		return true
	}
	if strings.Contains(src, `id(`) && strings.Contains(src, `"`) {
		return true
	}
	return strings.Contains(src, `implementation(`)
}

// extractGradleJavaVersion checks toolchain first, then legacy
// sourceCompatibility/targetCompatibility. Returns "" when silent.
func extractGradleJavaVersion(src string) string {
	if m := reJavaToolchain.FindStringSubmatch(src); len(m) == 2 {
		return m[1]
	}
	if m := reSourceCompat.FindStringSubmatch(src); len(m) == 2 {
		return m[1]
	}
	return ""
}
