package intel

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
)

// DepGraph maps file -> list of files it imports/requires.
type DepGraph map[string][]string

// BuildDepGraph scans a directory and builds an import dependency graph.
func BuildDepGraph(root string) (DepGraph, error) {
	graph := make(DepGraph)
	exts := map[string]bool{
		".ts": true, ".tsx": true, ".js": true, ".jsx": true,
		".go": true, ".py": true, ".rs": true, ".java": true,
	}

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return skipDirs(path, info)
		}
		ext := filepath.Ext(path)
		if !exts[ext] {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		deps := extractImports(path, ext, root)
		if len(deps) > 0 {
			graph[rel] = deps
		}
		return nil
	})
	return graph, err
}

func skipDirs(path string, info os.FileInfo) error {
	if info != nil && info.IsDir() {
		name := info.Name()
		if name == "node_modules" || name == ".git" || name == "vendor" ||
			name == "dist" || name == "build" || name == "__pycache__" ||
			name == ".next" || name == "target" {
			return filepath.SkipDir
		}
	}
	return nil
}

var (
	tsImportRe = regexp.MustCompile(`(?:import|from)\s+['"]([^'"]+)['"]`)
	goImportRe = regexp.MustCompile(`"([^"]+)"`)
	pyImportRe = regexp.MustCompile(`(?:from|import)\s+(\S+)`)
	rsUseRe    = regexp.MustCompile(`use\s+(\w[\w:]+)`)
	javaImptRe = regexp.MustCompile(`import\s+([\w.]+)`)
)

func extractImports(path, ext, root string) []string {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	var deps []string
	dir := filepath.Dir(path)
	scanner := bufio.NewScanner(f)

	for scanner.Scan() {
		line := scanner.Text()
		switch ext {
		case ".ts", ".tsx", ".js", ".jsx":
			deps = append(deps, matchTS(line, dir, root)...)
		case ".go":
			deps = append(deps, matchGo(line)...)
		case ".py":
			deps = append(deps, matchPy(line)...)
		case ".rs":
			deps = append(deps, matchRust(line)...)
		case ".java":
			deps = append(deps, matchJava(line)...)
		}
	}
	return unique(deps)
}

func unique(s []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, v := range s {
		if !seen[v] {
			seen[v] = true
			result = append(result, v)
		}
	}
	return result
}
