package main

import (
	"os"
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/migrate"
)

// firstAntConfig returns the relative path of the Ant build.xml that
// tryAntMigrate would pick — used for header-line bookkeeping.
func firstAntConfig(root string) string {
	return pickAntConfigFile(detect.ScanCIProviders(root))
}

// antTargetsForHeader re-parses the build.xml to grab target names
// for the "# Detected Ant targets: ..." comment. Cheap second pass.
func antTargetsForHeader(root, rel string) []string {
	if rel == "" {
		return nil
	}
	data, err := os.ReadFile(filepath.Join(root, rel))
	if err != nil {
		return nil
	}
	return migrate.ExtractAntTargets(string(data))
}
