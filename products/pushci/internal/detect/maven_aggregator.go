package detect

import (
	"os"
	"path/filepath"
	"regexp"
)

// reMavenModules matches a `<modules>...<module>child</module></modules>`
// block anywhere in a pom.xml. Cheap regex scan — we deliberately avoid
// the full XML parser here because this predicate runs for every
// candidate Java project during Scan and we don't want to pay the
// encoding/xml cost when a one-shot regex is enough.
var reMavenModules = regexp.MustCompile(`(?s)<modules>\s*<module>`)

// IsMavenAggregator reports whether the pom.xml at the given directory
// is a reactor (aggregator) pom — one whose only job is to wire child
// modules together. Two conditions must hold:
//
//  1. The pom declares at least one <module>.
//  2. There is no src/main (or src/test) directory, meaning no
//     buildable code lives at this level.
//
// Real code modules sit inside the children, so Scan should emit
// stages for the children but skip the aggregator itself. Otherwise
// `mvn install/build/test` runs twice per module: once via the reactor
// at the root stage, and once at the child stage — the exact bug
// caught dogfooding NinjaDKGenericInterface/NinjaDKSPInterface/
// NinjaServiceLayerCommon.
func IsMavenAggregator(dir string) bool {
	pomPath := filepath.Join(dir, "pom.xml")
	data, err := os.ReadFile(pomPath)
	if err != nil {
		return false
	}
	if !reMavenModules.Match(data) {
		return false
	}
	if hasSourceTree(dir) {
		return false
	}
	return true
}

// hasSourceTree returns true when the directory contains any of the
// canonical Maven source layouts. Used by IsMavenAggregator to decide
// whether a pom has real code alongside its <modules> list (a pom can
// legitimately be both — packaging=pom with modules PLUS src/main —
// though it's unusual).
func hasSourceTree(dir string) bool {
	for _, sub := range []string{
		filepath.Join("src", "main"),
		filepath.Join("src", "test"),
	} {
		info, err := os.Stat(filepath.Join(dir, sub))
		if err == nil && info.IsDir() {
			return true
		}
	}
	return false
}
