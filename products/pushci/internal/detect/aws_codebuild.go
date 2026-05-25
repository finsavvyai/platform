package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// buildspecMaxDepth caps how far ScanBuildspec walks. Mirrors
// jenkinsMaxDepth rationale — buildspec.yml usually lives at repo
// root, occasionally one level deep in service monorepos, and the
// depth cap also guards against vendored copies leaking past
// skipDirs.
const buildspecMaxDepth = 3

// ScanBuildspec walks root and emits a CIProvider entry for every
// AWS CodeBuild buildspec file. Accepted names (case-insensitive):
//
//   - buildspec.yml, buildspec.yaml
//   - buildspec_<env>.yml, buildspec_<env>.yaml
//
// The `_<env>.yml` form is common in repos that ship per-environment
// pipelines (buildspec_prod.yml, buildspec_dev.yml). Each distinct
// file shows up once in the result; the marker is always
// `ci:aws-codebuild` — variant information lives in ConfigFile.
func ScanBuildspec(root string) []CIProvider {
	var out []CIProvider
	seen := map[string]bool{}
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
			if depth > buildspecMaxDepth {
				return filepath.SkipDir
			}
			return nil
		}
		if !isBuildspecName(strings.ToLower(info.Name())) {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)
		if seen[rel] {
			return nil
		}
		seen[rel] = true
		out = append(out, CIProvider{Marker: "ci:aws-codebuild", ConfigFile: rel})
		return nil
	})
	return out
}

// isBuildspecName matches buildspec.yml / buildspec.yaml and the
// `buildspec_<env>.yml` variant. Input MUST already be lowercased.
func isBuildspecName(lower string) bool {
	if lower == "buildspec.yml" || lower == "buildspec.yaml" {
		return true
	}
	if !strings.HasPrefix(lower, "buildspec_") {
		return false
	}
	return strings.HasSuffix(lower, ".yml") || strings.HasSuffix(lower, ".yaml")
}

// HasBuildspec reports whether root contains any AWS CodeBuild
// buildspec file. Cheap shortcut for boolean-only callers.
func HasBuildspec(root string) bool {
	return len(ScanBuildspec(root)) > 0
}
