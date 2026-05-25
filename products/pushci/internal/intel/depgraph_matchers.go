package intel

import (
	"os"
	"path/filepath"
	"strings"
)

func matchTS(line, dir, root string) []string {
	matches := tsImportRe.FindAllStringSubmatch(line, -1)
	var deps []string
	for _, m := range matches {
		imp := m[1]
		if strings.HasPrefix(imp, ".") {
			resolved := resolveRelative(dir, imp, root)
			if resolved != "" {
				deps = append(deps, resolved)
			}
		}
	}
	return deps
}

func resolveRelative(dir, imp, root string) string {
	joined := filepath.Join(dir, imp)
	exts := []string{"", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"}
	for _, ext := range exts {
		candidate := joined + ext
		if _, err := os.Stat(candidate); err == nil {
			rel, _ := filepath.Rel(root, candidate)
			return rel
		}
	}
	return ""
}

func matchGo(line string) []string {
	if !strings.Contains(line, `"`) || strings.HasPrefix(strings.TrimSpace(line), "//") {
		return nil
	}
	matches := goImportRe.FindAllStringSubmatch(line, -1)
	var deps []string
	for _, m := range matches {
		if strings.Contains(m[1], "/") && !strings.HasPrefix(m[1], "fmt") {
			deps = append(deps, m[1])
		}
	}
	return deps
}

func matchPy(line string) []string {
	m := pyImportRe.FindStringSubmatch(line)
	if m == nil {
		return nil
	}
	mod := strings.ReplaceAll(m[1], ".", "/") + ".py"
	return []string{mod}
}

func matchRust(line string) []string {
	m := rsUseRe.FindStringSubmatch(line)
	if m == nil {
		return nil
	}
	return []string{strings.ReplaceAll(m[1], "::", "/")}
}

func matchJava(line string) []string {
	m := javaImptRe.FindStringSubmatch(line)
	if m == nil {
		return nil
	}
	return []string{strings.ReplaceAll(m[1], ".", "/") + ".java"}
}
