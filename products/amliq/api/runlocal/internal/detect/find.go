package detect

import (
	"os"
	"path/filepath"
	"strings"
)

var skipDirs = map[string]bool{
	"node_modules": true, "vendor": true, ".git": true,
	"target": true, "dist": true, "build": true,
	".claude": true, "__pycache__": true, ".venv": true,
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

func findGlob(root, pattern string, maxDepth int) []string {
	var results []string
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
		if matched, _ := filepath.Match(pattern, info.Name()); matched {
			results = append(results, path)
		}
		return nil
	})
	return results
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func fileContains(path, substr string) bool {
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	return strings.Contains(string(data), substr)
}
