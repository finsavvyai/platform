package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// skipDirs lists directories the scanner must never descend into. Two
// categories:
//
//  1. Dependency / vendored directories (node_modules, vendor, target)
//     where `package.json` and friends are generated and belong to
//     other projects.
//  2. Framework build artifacts (.next, .turbo, .cache, .svelte-kit,
//     .nuxt, .output, .angular, .expo, .parcel-cache, .docusaurus,
//     coverage, out). These frequently contain a generated
//     package.json that would otherwise show up as a fake "project".
//
// Every new framework that ships a .<name>/ build cache should be
// added here. The opensyber dogfood report caught .next, .turbo, and
// .cache; the rest were added preventively.
var skipDirs = map[string]bool{
	// Dependencies / vendoring
	"node_modules": true,
	"vendor":       true,
	".git":         true,
	"target":       true,
	"dist":         true,
	"build":        true,
	"__pycache__":  true,
	".venv":        true,
	".claude":      true,
	// Framework build artifacts
	".next":         true, // Next.js
	".turbo":        true, // Turborepo cache
	".cache":        true, // Parcel, Gatsby, etc.
	".svelte-kit":   true, // SvelteKit
	".nuxt":         true, // Nuxt 2
	".output":       true, // Nuxt 3 / Nitro
	".angular":      true, // Angular CLI
	".expo":         true, // Expo / React Native
	".parcel-cache": true, // Parcel
	".docusaurus":   true, // Docusaurus
	"coverage":      true, // Istanbul / nyc
	"out":           true, // Next.js static export
}

func findFiles(root, pattern string, maxDepth int) []string {
	var results []string
	// Handle glob patterns like *.csproj
	if strings.Contains(pattern, "*") {
		return findGlob(root, pattern, maxDepth)
	}
	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if skipDirs[info.Name()] {
				return filepath.SkipDir
			}
			depth := strings.Count(
				strings.TrimPrefix(path, root), string(os.PathSeparator),
			)
			if depth > maxDepth {
				return filepath.SkipDir
			}
			return nil
		}
		if info.Name() == pattern {
			results = append(results, path)
		}
		return nil
	})
	return results
}

// findGlob, fileExists, readFileString, fileContains live in find_utils.go.
