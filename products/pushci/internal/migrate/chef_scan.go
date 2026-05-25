package migrate

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// scanValidateScripts walks the repo root (not recursive) for the
// validate-*.sh / validate-*.py helpers common to Chef monorepos
// (e.g. Telia's validate-changed-json-files.sh + validate-json.py).
func scanValidateScripts(root string) []string {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	var out []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		n := e.Name()
		if !strings.HasPrefix(n, "validate") {
			continue
		}
		if strings.HasSuffix(n, ".sh") || strings.HasSuffix(n, ".py") {
			out = append(out, n)
		}
	}
	sort.Strings(out)
	return out
}

// scanForKnife greps the validate scripts for literal `knife`
// invocations — a deprecated pattern worth flagging.
func scanForKnife(root string, scripts []string) bool {
	for _, s := range scripts {
		if data, err := os.ReadFile(filepath.Join(root, s)); err == nil {
			if strings.Contains(string(data), "knife ") {
				return true
			}
		}
	}
	return false
}

func fileExists(p string) bool {
	info, err := os.Stat(p)
	return err == nil && !info.IsDir()
}

// dirHasRubyFiles returns true when dir (or any sub-dir) contains
// at least one .rb file — the signal used to detect ChefSpec specs.
func dirHasRubyFiles(dir string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if e.IsDir() {
			if dirHasRubyFiles(filepath.Join(dir, e.Name())) {
				return true
			}
			continue
		}
		if strings.HasSuffix(e.Name(), ".rb") {
			return true
		}
	}
	return false
}
