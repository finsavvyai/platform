package detect

import "path/filepath"

// detectScalaFramework checks build.sbt for known Scala frameworks.
func detectScalaFramework(base string) string {
	sbt := filepath.Join(base, "build.sbt")
	if fileContains(sbt, "play") {
		return "play"
	}
	return ""
}
